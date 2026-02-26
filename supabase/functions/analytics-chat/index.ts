import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCHEMA_CONTEXT = `
## DATABASE SCHEMA (use this to write SQL queries)

TABLE: events
- id (uuid, PK)
- project_id (uuid, FK -> projects.id)
- event_name (text)
- user_identifier (text, nullable)
- page_url (text, nullable)
- properties (jsonb, default '{}')
- timestamp (timestamptz)
- created_at (timestamptz)

TABLE: projects
- id (uuid, PK)
- user_id (uuid)
- name (text)
- api_key (text)

NOTES:
- Always filter events by project_id IN (user's project IDs) — RLS handles this automatically
- Use timestamp for time-based queries, not created_at
- properties is JSONB — use properties->>'key' or properties->'key' for access
- user_identifier is how end-users are tracked (can be email, ID, etc.)
`;

const SYSTEM_PROMPT = `You are ECP's analytics assistant. You have DIRECT ACCESS to the user's event database and MUST query it to answer data questions. NEVER tell the user to check PostHog, Mixpanel, or any external dashboard — YOU are the dashboard.

## CRITICAL RULE
When the user asks for data (visitors, events, counts, trends, funnels, etc.), you MUST write a SQL query to fetch it. Do NOT say "I can't access" or "check your dashboard." You have full read access to their events table.

## HOW TO ANSWER DATA QUESTIONS

1. Briefly state your query plan (1-2 sentences max)
2. Write the SQL query inside <SQL> tags — the system executes it and returns results
3. After receiving results, interpret and present them with widgets

Example:
<SQL>SELECT event_name, COUNT(*) as count FROM events GROUP BY event_name ORDER BY count DESC LIMIT 20</SQL>

Rules for SQL:
- Write efficient PostgreSQL queries
- Use timestamp for time ranges: timestamp >= now() - interval '7 days'
- For visitors/DAU: COUNT(DISTINCT user_identifier) grouped by date
- For pageviews: filter by event_name = '$pageview' or similar
- For funnels: use conditional aggregation or CTEs
- ONLY write SELECT or WITH...SELECT queries
- Do NOT include trailing semicolons
- LIMIT results to 100 max
- Write exactly ONE <SQL> block per response

## RICH WIDGETS
When presenting data, use these special code blocks to render visual widgets:

### Funnel Widget
\`\`\`funnel
{"title":"Funnel Name","steps":[{"label":"Step 1","value":100},{"label":"Step 2","value":50}]}
\`\`\`

### Metrics Widget
\`\`\`metrics
{"metrics":[{"label":"DAU Today","value":12,"change":25},{"label":"MAU","value":89}]}
\`\`\`

### Top Events Widget
\`\`\`top-events
{"title":"Top Events","events":[{"name":"page_view","count":340,"users":28}]}
\`\`\`

ALWAYS use these widgets when presenting quantitative data. Use real numbers from query results.

Guidelines:
- Be concise — use bullet points, not paragraphs
- ALWAYS query first, interpret second
- Use business context to give tailored advice
- Be practical and actionable
- If a query returns no data, say so honestly`;

// Provider routing helpers
interface LlmConfig {
  provider?: string;
  model?: string;
  openai_key?: string;
  anthropic_key?: string;
  google_key?: string;
}

function getAIEndpoint(config?: LlmConfig): { url: string; apiKey: string; model: string; isAnthropic: boolean } {
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

async function streamAI(endpoint: ReturnType<typeof getAIEndpoint>, messages: any[]): Promise<Response> {
  if (endpoint.isAnthropic) {
    const systemMsg = messages.find((m: any) => m.role === "system");
    const nonSystemMsgs = messages.filter((m: any) => m.role !== "system");
    return fetch(endpoint.url, {
      method: "POST",
      headers: { "x-api-key": endpoint.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: endpoint.model,
        max_tokens: 4096,
        system: systemMsg?.content || "",
        messages: nonSystemMsgs,
        stream: true,
      }),
    });
  }

  return fetch(endpoint.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${endpoint.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: endpoint.model, messages, stream: true }),
  });
}

async function collectStream(response: Response, isAnthropic: boolean): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        if (isAnthropic) {
          if (parsed.type === "content_block_delta" && parsed.delta?.text) fullText += parsed.delta.text;
        } else {
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) fullText += content;
        }
      } catch { /* skip */ }
    }
  }
  return fullText;
}

function transformAnthropicToSSE(response: Response): ReadableStream {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close(); break; }
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data: ")) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: parsed.delta.text } }] })}\n\n`));
              }
            } catch { /* skip */ }
          }
        }
      } catch (e) { controller.error(e); }
    },
  });
}

async function executeQuery(supabase: any, sql: string): Promise<{ data: any; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("execute_readonly_query", { query_text: sql });
    if (error) return { data: null, error: error.message };
    return { data: data || [], error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Query execution failed" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, business_context, repo_context } = await req.json();

    // Build system prompt
    let systemPrompt = SYSTEM_PROMPT + "\n" + SCHEMA_CONTEXT;

    if (business_context) {
      systemPrompt += `\n\n## BUSINESS CONTEXT\n`;
      if (business_context.product_description) systemPrompt += `- Product: ${business_context.product_description}\n`;
      if (business_context.audience) systemPrompt += `- Audience: ${business_context.audience}\n`;
      if (business_context.goals) systemPrompt += `- Goals: ${business_context.goals}\n`;
      if (business_context.stage) systemPrompt += `- Stage: ${business_context.stage}\n`;
      if (business_context.challenges) systemPrompt += `- Challenges: ${business_context.challenges}\n`;
    }

    if (repo_context) {
      systemPrompt += `\n\n## CODEBASE CONTEXT\n${repo_context.slice(0, 6000)}`;
    }

    // Set up authenticated supabase client & get user LLM config
    let supabase: any = null;
    let llmConfig: LlmConfig | undefined;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from("profiles").select("onboarding_data").eq("user_id", user.id).single();
          llmConfig = (profile?.onboarding_data as any)?.llm_config;
        }
      } catch { /* proceed without config */ }
    }

    // Fetch event annotations to enrich context
    if (supabase) {
      const { data: annotations } = await supabase
        .from("event_annotations")
        .select("event_name, description, category")
        .neq("status", "deprecated")
        .limit(200);

      if (annotations && annotations.length > 0) {
        systemPrompt += `\n\n## EVENT DICTIONARY (Use these to understand what events mean)\n`;
        systemPrompt += annotations.map((a: any) =>
          `- ${a.event_name}: ${a.description || "No description"} [${a.category || "general"}]`
        ).join("\n");
      }
    }

    const endpoint = getAIEndpoint(llmConfig);
    if (!endpoint.apiKey) throw new Error("No API key configured");

    // PASS 1: Stream and collect — check if AI wants to run SQL
    console.log("Pass 1: asking AI for plan/SQL...");
    const pass1Response = await streamAI(endpoint, [
      { role: "system", content: systemPrompt },
      ...messages,
    ]);

    if (!pass1Response.ok) {
      const status = pass1Response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await pass1Response.text();
      console.error("AI pass1 error:", status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect the full pass 1 text
    const pass1Text = await collectStream(pass1Response, endpoint.isAnthropic);
    console.log("Pass 1 complete, length:", pass1Text.length);

    // Check for <SQL> tag
    const sqlMatch = pass1Text.match(/<SQL>([\s\S]*?)<\/SQL>/i);

    if (!sqlMatch || !supabase) {
      // No SQL needed — stream pass1 text as SSE directly
      console.log("No SQL found, returning pass 1 as-is");
      const encoder = new TextEncoder();
      // Strip any <SQL> tags that might be malformed
      const cleanText = pass1Text.replace(/<\/?SQL>/gi, "");
      const stream = new ReadableStream({
        start(controller) {
          // Send in chunks for smoother rendering
          const chunkSize = 20;
          for (let i = 0; i < cleanText.length; i += chunkSize) {
            const chunk = cleanText.slice(i, i + chunkSize);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: chunk } }] })}\n\n`)
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Execute the SQL
    const sql = sqlMatch[1].trim().replace(/;$/, "");
    console.log("Executing SQL:", sql);
    const queryResult = await executeQuery(supabase, sql);
    console.log("Query result:", queryResult.error ? `error: ${queryResult.error}` : `${queryResult.data?.length || 0} rows`);

    // Get the text before the SQL tag (the plan explanation)
    const beforeSql = pass1Text.split(/<SQL>/i)[0].trim();

    // PASS 2: Stream the interpretation with query results
    const pass2Messages = [
      { role: "system", content: systemPrompt },
      ...messages,
      { role: "assistant", content: beforeSql + "\n\n*Running query...*" },
      {
        role: "user",
        content: queryResult.error
          ? `The query returned an error: ${queryResult.error}. Please explain what went wrong and suggest a fix.`
          : `Query results (${queryResult.data?.length || 0} rows):\n\`\`\`json\n${JSON.stringify(queryResult.data?.slice(0, 100), null, 2)}\n\`\`\`\n\nInterpret these results and present insights. Use the rich widgets (funnel, metrics, top-events) where appropriate. Be specific with numbers.`,
      },
    ];

    console.log("Pass 2: streaming interpretation...");
    const pass2Response = await streamAI(endpoint, pass2Messages);

    if (!pass2Response.ok) {
      const t = await pass2Response.text();
      console.error("AI pass2 error:", pass2Response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream pass 2 with the plan prefix
    const encoder = new TextEncoder();
    const prefixText = beforeSql + "\n\n---\n\n";
    const pass2Body = endpoint.isAnthropic ? transformAnthropicToSSE(pass2Response) : pass2Response.body!;
    const pass2Reader = pass2Body.getReader();

    const outputStream = new ReadableStream({
      async start(controller) {
        // First emit the plan explanation from pass 1
        const prefixChunkSize = 20;
        for (let i = 0; i < prefixText.length; i += prefixChunkSize) {
          const chunk = prefixText.slice(i, i + prefixChunkSize);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: chunk } }] })}\n\n`)
          );
        }

        // Then pipe pass 2 stream
        try {
          while (true) {
            const { done, value } = await pass2Reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (e) {
          controller.error(e);
          return;
        }
        controller.close();
      },
    });

    return new Response(outputStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analytics-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
