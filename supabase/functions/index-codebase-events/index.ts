import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|py)$/;
const SKIP_PATTERNS = /node_modules|dist\/|build\/|\.test\.|\.spec\.|\.d\.ts|\.css$|\.json$|\.md$|\.svg$|\.png$|\.jpg$|\.gif$|\.ico$|\.woff/;
const PRIORITY_KEYWORDS = /analytics|tracking|events?|posthog|mixpanel|gtag|segment|amplitude/i;

const TRACKING_PATTERNS = [
  /\.(capture|track|logEvent|send)\s*\(\s*['"]([\w.:\-/ ]+)['"]/g,
  /gtag\s*\(\s*['"]event['"]\s*,\s*['"]([\w.:\-/ ]+)['"]/g,
  /trackEvent\s*\(\s*['"]([\w.:\-/ ]+)['"]/g,
  /logAnalytics\s*\(\s*['"]([\w.:\-/ ]+)['"]/g,
  /dataLayer\.push\s*\(\s*\{[^}]*['"]event['"]\s*:\s*['"]([\w.:\-/ ]+)['"]/g,
  /analytics\.(identify|page|group)\s*\(\s*['"]([\w.:\-/ ]+)['"]/g,
  /mixpanel\.track\s*\(\s*['"]([\w.:\-/ ]+)['"]/g,
];

interface FileEntry {
  path: string;
  type: string;
  size?: number;
}

async function fetchGitHub(url: string, pat?: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ECP-App",
  };
  if (pat) headers.Authorization = `Bearer ${pat}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${text}`);
  }
  return resp.json();
}

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

function selectFiles(tree: FileEntry[]): FileEntry[] {
  const sourceFiles = tree.filter(
    (f) => f.type === "blob" && SOURCE_EXTENSIONS.test(f.path) && !SKIP_PATTERNS.test(f.path)
  );

  const priority = sourceFiles.filter((f) => PRIORITY_KEYWORDS.test(f.path));
  const others = sourceFiles.filter((f) => !PRIORITY_KEYWORDS.test(f.path));

  // Priority files first, then others, up to 20
  return [...priority, ...others].slice(0, 20);
}

function extractTrackingCalls(content: string, filePath: string) {
  const lines = content.split("\n");
  const matches: Array<{ event_name: string; snippet: string; line: number }> = [];

  for (const pattern of TRACKING_PATTERNS) {
    // Reset regex
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      // Find the event name - it's in group 2 for the first pattern, group 1 for gtag
      const eventName = match[2] || match[1];
      
      // Find line number
      const upToMatch = content.slice(0, match.index);
      const lineNum = upToMatch.split("\n").length - 1;

      // Extract ~5 lines before and after for focused context
      const start = Math.max(0, lineNum - 5);
      const end = Math.min(lines.length, lineNum + 5);
      const snippet = lines.slice(start, end).join("\n");

      matches.push({ event_name: eventName, snippet, line: lineNum + 1 });
    }
  }

  return matches;
}

interface LlmConfig {
  provider?: string;
  model?: string;
  openai_key?: string;
  anthropic_key?: string;
  google_key?: string;
}

function getAIEndpoint(config?: LlmConfig) {
  if (config?.provider && config.provider !== "default") {
    switch (config.provider) {
      case "openai":
        if (config.openai_key) return { url: "https://api.openai.com/v1/chat/completions", apiKey: config.openai_key, model: config.model || "gpt-4o-mini", isAnthropic: false };
        break;
      case "anthropic":
        if (config.anthropic_key) return { url: "https://api.anthropic.com/v1/messages", apiKey: config.anthropic_key, model: config.model || "claude-sonnet-4-20250514", isAnthropic: true };
        break;
      case "google":
        if (config.google_key) return { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiKey: config.google_key, model: config.model || "gemini-2.5-flash", isAnthropic: false };
        break;
    }
  }
  return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: Deno.env.get("LOVABLE_API_KEY") || "", model: "google/gemini-3-flash-preview", isAnthropic: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { project_id, github_url, github_pat } = await req.json();
    if (!project_id || !github_url) {
      return new Response(JSON.stringify({ error: "project_id and github_url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Get user LLM config
    let llmConfig: LlmConfig | undefined;
    try {
      const { data: profile } = await supabase.from("profiles").select("onboarding_data").eq("user_id", user.id).single();
      llmConfig = (profile?.onboarding_data as any)?.llm_config;
    } catch { /* ignore */ }

    const parsed = parseRepoUrl(github_url);
    if (!parsed) throw new Error("Invalid GitHub URL");

    const { owner, repo } = parsed;
    const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

    // Fetch file tree
    const tree = await fetchGitHub(`${apiBase}/git/trees/HEAD?recursive=1`, github_pat).catch(() => ({ tree: [] }));
    const treeFiles = (tree.tree || []) as FileEntry[];
    const filesToFetch = selectFiles(treeFiles);

    console.log(`Found ${filesToFetch.length} source files to scan`);

    // Fetch file contents in parallel (batches of 5)
    const allTrackingCalls: Array<{ event_name: string; snippet: string; file_path: string; line: number }> = [];
    const codebaseFileRows: Array<{ project_id: string; file_path: string; content_snippet: string; has_tracking_calls: boolean }> = [];

    for (let i = 0; i < filesToFetch.length; i += 5) {
      const batch = filesToFetch.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (file) => {
          const content = await fetchGitHub(`${apiBase}/contents/${file.path}`, github_pat);
          if (content.encoding === "base64" && content.content) {
            const decoded = atob(content.content.replace(/\n/g, ""));
            const calls = extractTrackingCalls(decoded, file.path);
            
            if (calls.length > 0) {
              for (const call of calls) {
                allTrackingCalls.push({ ...call, file_path: file.path });
              }
              codebaseFileRows.push({
                project_id,
                file_path: file.path,
                content_snippet: calls.map((c) => `// Line ${c.line}\n${c.snippet}`).join("\n\n---\n\n").slice(0, 10000),
                has_tracking_calls: true,
              });
            }
          }
        })
      );
    }

    console.log(`Found ${allTrackingCalls.length} tracking calls across ${codebaseFileRows.length} files`);

    // Save to codebase_files using service role for upsert
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {});
    
    if (codebaseFileRows.length > 0) {
      const { error: upsertError } = await serviceClient
        .from("codebase_files")
        .upsert(
          codebaseFileRows.map((r) => ({ ...r, last_synced_at: new Date().toISOString() })),
          { onConflict: "project_id,file_path" }
        );
      if (upsertError) console.error("codebase_files upsert error:", upsertError);
    }

    // If we have tracking calls, send to AI for interpretation
    let aiDiscoveredCount = 0;
    if (allTrackingCalls.length > 0) {
      const endpoint = getAIEndpoint(llmConfig);

      const snippetsText = allTrackingCalls
        .map((c) => `File: ${c.file_path} (line ${c.line})\nEvent: ${c.event_name}\nCode:\n${c.snippet}`)
        .join("\n\n===\n\n")
        .slice(0, 30000);

      const systemPrompt = `You are a code analysis expert. Given compact code snippets (~10 lines) around event tracking calls, interpret the business meaning of each event.

Focus on:
- The function/method name wrapping the tracking call (e.g. handleSignup, onCheckout) to infer user action
- The property keys passed with the event (e.g. { plan, price, item_id }) for business context
- Whether the code is in a click handler, form submit, page load, API callback, etc.

Return a JSON object:
{
  "events": [
    {
      "event_name": "exact_event_name_from_code",
      "description": "Business meaning: what user action triggers this and why it matters",
      "category": "one of: acquisition, activation, retention, revenue, core, content, other"
    }
  ]
}

Deduplicate events with the same name. Only return valid JSON, no markdown.`;

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here are the tracking calls found in the codebase:\n\n${snippetsText}` },
      ];

      try {
        let response;
        if (endpoint.isAnthropic) {
          response = await fetch(endpoint.url, {
            method: "POST",
            headers: { "x-api-key": endpoint.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
            body: JSON.stringify({ model: endpoint.model, max_tokens: 4096, system: systemPrompt, messages: messages.filter((m) => m.role !== "system") }),
          });
        } else {
          response = await fetch(endpoint.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${endpoint.apiKey}` },
            body: JSON.stringify({ model: endpoint.model, messages }),
          });
        }

        if (response.ok) {
          const aiData = await response.json();
          let content = endpoint.isAnthropic ? aiData.content[0].text : aiData.choices[0].message.content;
          content = content.replace(/```json\n?|\n?```/g, "").trim();
          const result = JSON.parse(content);

          if (result.events && Array.isArray(result.events)) {
            for (const event of result.events) {
              const { data: existing } = await supabase
                .from("event_annotations")
                .select("id")
                .eq("project_id", project_id)
                .eq("event_name", event.event_name)
                .maybeSingle();

              if (!existing) {
                await supabase.from("event_annotations").insert({
                  project_id,
                  event_name: event.event_name,
                  description: event.description,
                  category: event.category,
                  status: "discovered",
                });
                aiDiscoveredCount++;
              }
            }
          }
        } else {
          console.error("AI API error:", response.status, await response.text());
        }
      } catch (aiErr) {
        console.error("AI interpretation error:", aiErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        files_scanned: filesToFetch.length,
        tracking_calls_found: allTrackingCalls.length,
        events_discovered: aiDiscoveredCount,
        raw_events: [...new Set(allTrackingCalls.map((c) => c.event_name))],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("index-codebase-events error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
