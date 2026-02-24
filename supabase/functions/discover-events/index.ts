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

async function getUserLlmConfig(supabase: any, userId: string): Promise<LlmConfig | undefined> {
  try {
    const { data: profile } = await supabase.from("profiles").select("onboarding_data").eq("user_id", userId).single();
    return (profile?.onboarding_data as any)?.llm_config;
  } catch {
    return undefined;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { repo_context, project_id } = await req.json();

    if (!repo_context || !project_id) {
      throw new Error("Missing repo_context or project_id");
    }

    // Auth check
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
    const llmConfig = await getUserLlmConfig(supabase, user.id);
    const endpoint = getAIEndpoint(llmConfig);

    const systemPrompt = `You are a code analysis expert. Your task is to extract event tracking calls from the provided codebase context.
    
Look for patterns like:
- posthog.capture('event_name', { properties })
- mixpanel.track('event_name', { properties })
- analytics.track('event_name')
- gtag('event', 'event_name')
- custom wrapper functions that look like tracking calls

Return a JSON object with a list of discovered events.
Format:
{
  "events": [
    {
      "event_name": "string",
      "description": "Inferred meaning based on code context (e.g. 'Triggered when user clicks signup button')",
      "category": "string (e.g. 'auth', 'navigation', 'conversion', 'content')"
    }
  ]
}

Only return valid JSON. Do not include markdown formatting.`;

    // Prepare messages
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Here is the codebase context:\n\n${repo_context.slice(0, 20000)}` }
    ];

    let response;
    if (endpoint.isAnthropic) {
       const anthropicMessages = messages.map((m: any) => ({ role: m.role === "system" ? "user" : m.role, content: m.content }));
       response = await fetch(endpoint.url, {
        method: "POST",
        headers: { "x-api-key": endpoint.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: endpoint.model, max_tokens: 4096, system: systemPrompt, messages: anthropicMessages }),
      });
    } else {
      const headers: Record<string, string> = { "Content-Type": "application/json", "Authorization": `Bearer ${endpoint.apiKey}` };
      response = await fetch(endpoint.url, {
        method: "POST", headers,
        body: JSON.stringify({ model: endpoint.model, messages }),
      });
    }

    if (!response.ok) throw new Error(`AI API error: ${response.status}`);
    const aiData = await response.json();
    let content = endpoint.isAnthropic ? aiData.content[0].text : aiData.choices[0].message.content;
    
    // Clean up markdown code blocks if present
    content = content.replace(/```json\n?|\n?```/g, "").trim();
    
    const result = JSON.parse(content);
    
    if (result.events && Array.isArray(result.events)) {
      // Upsert events into database
      for (const event of result.events) {
        // Check if event already exists
        const { data: existing } = await supabase
          .from("event_annotations")
          .select("id")
          .eq("project_id", project_id)
          .eq("event_name", event.event_name)
          .single();
          
        if (!existing) {
          await supabase.from("event_annotations").insert({
            project_id,
            event_name: event.event_name,
            description: event.description,
            category: event.category,
            status: "discovered"
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, count: result.events?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
