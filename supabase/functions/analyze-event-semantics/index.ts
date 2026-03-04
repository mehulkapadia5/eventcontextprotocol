import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { project_id } = await req.json();
    if (!project_id) throw new Error("project_id required");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) throw new Error("Unauthorized");
    const userId = claims.claims.sub as string;

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get LLM config
    let llmConfig: LlmConfig | undefined;
    try {
      const { data: profile } = await serviceClient.from("profiles").select("onboarding_data").eq("user_id", userId).single();
      llmConfig = (profile?.onboarding_data as any)?.llm_config;
    } catch { /* default */ }

    const endpoint = getAIEndpoint(llmConfig);

    // Fetch all code locations grouped by event
    const { data: locations, error: locErr } = await serviceClient
      .from("event_code_locations")
      .select("*")
      .eq("project_id", project_id)
      .order("event_name");
    if (locErr) throw locErr;
    if (!locations || locations.length === 0) {
      return new Response(JSON.stringify({ success: true, analyzed: 0, message: "No code locations found. Run search step first." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by event name
    const grouped = new Map<string, any[]>();
    for (const loc of locations) {
      const arr = grouped.get(loc.event_name) || [];
      arr.push(loc);
      grouped.set(loc.event_name, arr);
    }

    const eventNames = [...grouped.keys()];
    let analyzedCount = 0;

    // Process in batches of 5 events
    for (let i = 0; i < eventNames.length; i += 5) {
      const batch = eventNames.slice(i, i + 5);

      const eventsText = batch.map((name) => {
        const locs = grouped.get(name)!;
        const locsText = locs.map((l: any, idx: number) =>
          `Location ${idx + 1}: ${l.file_path} (line ${l.line_number})\n${l.code_snippet}`
        ).join("\n\n");
        return `Event name: "${name}"\n\nFound in ${locs.length} location(s):\n\n${locsText}`;
      }).join("\n\n========\n\n");

      const systemPrompt = `You are a product analytics expert analyzing source code to understand event tracking.

For each event, analyze ALL its code locations and return:
1. A business-friendly description of what this event means
2. What user action triggers it
3. What properties/data it captures
4. The category: acquisition, activation, retention, revenue, core, content, or other
5. If found in multiple places, explain why

Return JSON:
{
  "events": [
    {
      "event_name": "exact_name",
      "description": "Business meaning (1-2 sentences)",
      "category": "category",
      "locations": [
        { "file_path": "path", "semantic_meaning": "What this specific usage does" }
      ]
    }
  ]
}
Only return valid JSON, no markdown.`;

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: eventsText.slice(0, 50000) },
      ];

      try {
        let response;
        if (endpoint.isAnthropic) {
          response = await fetch(endpoint.url, {
            method: "POST",
            headers: { "x-api-key": endpoint.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
            body: JSON.stringify({ model: endpoint.model, max_tokens: 4096, system: systemPrompt, messages: [{ role: "user", content: eventsText.slice(0, 50000) }] }),
          });
        } else {
          response = await fetch(endpoint.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${endpoint.apiKey}` },
            body: JSON.stringify({ model: endpoint.model, messages }),
          });
        }

        if (!response.ok) { console.error("AI error:", response.status); continue; }
        const aiData = await response.json();
        let content = endpoint.isAnthropic ? aiData.content[0].text : aiData.choices[0].message.content;
        content = content.replace(/```json\n?|\n?```/g, "").trim();
        const result = JSON.parse(content);

        if (result.events && Array.isArray(result.events)) {
          for (const ev of result.events) {
            // Update semantic_meaning on each location
            if (ev.locations) {
              for (const loc of ev.locations) {
                await serviceClient.from("event_code_locations")
                  .update({ semantic_meaning: loc.semantic_meaning, updated_at: new Date().toISOString() })
                  .eq("project_id", project_id)
                  .eq("event_name", ev.event_name)
                  .eq("file_path", loc.file_path);
              }
            }

            // Upsert event_annotations
            const { data: existing } = await serviceClient
              .from("event_annotations")
              .select("id")
              .eq("project_id", project_id)
              .eq("event_name", ev.event_name)
              .maybeSingle();

            if (existing) {
              await serviceClient.from("event_annotations").update({
                description: ev.description,
                category: ev.category,
                status: "verified",
                updated_at: new Date().toISOString(),
              }).eq("id", existing.id);
            } else {
              await serviceClient.from("event_annotations").insert({
                project_id,
                event_name: ev.event_name,
                description: ev.description,
                category: ev.category,
                status: "verified",
              });
            }
            analyzedCount++;
          }
        }
      } catch (aiErr) {
        console.error("AI batch error:", aiErr);
      }
    }

    return new Response(JSON.stringify({ success: true, analyzed: analyzedCount, total_events: eventNames.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-event-semantics error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
