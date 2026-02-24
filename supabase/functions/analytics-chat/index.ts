import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are ECP's analytics assistant. You have deep knowledge of the user's business and help them with analytics questions.

Your capabilities:
- Help users understand what events to track and why
- Suggest event naming conventions and taxonomy
- Explain analytics concepts (funnels, cohorts, retention, etc.)
- Help interpret what metrics mean for their specific business
- Suggest KPIs and dashboards relevant to their product
- Help with PostHog and Mixpanel query strategies
- Advise on event properties and user identification

Guidelines:
- Be concise but thorough (2-5 sentences per response usually)
- Use the business context provided to give tailored, specific advice
- Reference their actual product, audience, and goals when relevant
- If they ask about something outside analytics, gently redirect
- Use markdown formatting for lists, code blocks, and emphasis
- Be practical — give actionable advice, not just theory`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, business_context, repo_context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = SYSTEM_PROMPT;

    if (business_context) {
      systemPrompt += `\n\nHere is the user's business context:\n`;
      if (business_context.product_description) systemPrompt += `- Product: ${business_context.product_description}\n`;
      if (business_context.audience) systemPrompt += `- Audience: ${business_context.audience}\n`;
      if (business_context.goals) systemPrompt += `- Goals: ${business_context.goals}\n`;
      if (business_context.stage) systemPrompt += `- Stage: ${business_context.stage}\n`;
      if (business_context.challenges) systemPrompt += `- Challenges: ${business_context.challenges}\n`;
    }

    if (repo_context) {
      systemPrompt += `\n\nThe user's codebase context:\n${repo_context.slice(0, 6000)}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analytics-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
