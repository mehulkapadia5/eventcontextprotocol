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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { project_id, business_context } = await req.json();
    if (!project_id || !business_context) throw new Error("Missing project_id or business_context");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Get existing annotations for this project
    const { data: annotations, error: fetchErr } = await supabase
      .from("event_annotations")
      .select("*")
      .eq("project_id", project_id);
    if (fetchErr) throw fetchErr;
    if (!annotations || annotations.length === 0) {
      return new Response(JSON.stringify({ success: true, enriched: 0, message: "No events to enrich" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user LLM config
    let llmConfig: LlmConfig | undefined;
    try {
      const { data: profile } = await supabase.from("profiles").select("onboarding_data").eq("user_id", user.id).single();
      llmConfig = (profile?.onboarding_data as any)?.llm_config;
    } catch { /* proceed with default */ }

    const endpoint = getAIEndpoint(llmConfig);

    const eventList = annotations.map((a: any) => ({
      event_name: a.event_name,
      current_description: a.description || "",
      current_category: a.category || "",
    }));

    const systemPrompt = `You are a product analytics expert. Given business context about a product and a list of tracked events, your job is to enrich each event with:
1. A clear, business-friendly description that explains what the event means in the context of THIS specific product
2. The most appropriate category from: acquisition, activation, retention, revenue, core, content, other

Business Context:
- Product: ${business_context.product_description || "Unknown"}
- Audience: ${business_context.audience || "Unknown"}
- Goals: ${business_context.goals || "Unknown"}
- Stage: ${business_context.stage || "Unknown"}
- Challenges: ${business_context.challenges || "Unknown"}

Return a JSON object:
{
  "events": [
    {
      "event_name": "exact_original_name",
      "description": "Business-friendly description (1-2 sentences, explain WHAT it means for the product, not just what it does technically)",
      "category": "one of: acquisition, activation, retention, revenue, core, content, other"
    }
  ]
}

Guidelines:
- Descriptions should reference the product's domain (e.g. "User completed a study session" not "User triggered session_complete event")
- Category should reflect the event's role in the business funnel
- Keep descriptions concise but informative
- Only return valid JSON, no markdown formatting`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Here are the events to enrich:\n${JSON.stringify(eventList, null, 2)}` },
    ];

    let response;
    if (endpoint.isAnthropic) {
      response = await fetch(endpoint.url, {
        method: "POST",
        headers: { "x-api-key": endpoint.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: endpoint.model, max_tokens: 4096, system: systemPrompt, messages: [{ role: "user", content: `Here are the events to enrich:\n${JSON.stringify(eventList, null, 2)}` }] }),
      });
    } else {
      response = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${endpoint.apiKey}` },
        body: JSON.stringify({ model: endpoint.model, messages }),
      });
    }

    if (!response.ok) throw new Error(`AI API error: ${response.status}`);
    const aiData = await response.json();
    let content = endpoint.isAnthropic ? aiData.content[0].text : aiData.choices[0].message.content;
    content = content.replace(/```json\n?|\n?```/g, "").trim();

    const result = JSON.parse(content);
    let enrichedCount = 0;

    if (result.events && Array.isArray(result.events)) {
      for (const enriched of result.events) {
        // Find matching annotation
        const existing = annotations.find((a: any) => a.event_name === enriched.event_name);
        if (existing) {
          const { error: updateErr } = await supabase
            .from("event_annotations")
            .update({
              description: enriched.description,
              category: enriched.category,
              status: existing.status === "discovered" ? "verified" : existing.status,
            })
            .eq("id", existing.id);
          if (!updateErr) enrichedCount++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, enriched: enrichedCount }), {
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
