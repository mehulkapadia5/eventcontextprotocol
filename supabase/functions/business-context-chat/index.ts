import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are ECP's onboarding assistant. Your goal is to understand the user's business context so the platform can deliver tailored event analytics insights.

You need to gather information across these dimensions:
1. PRODUCT: What the product does, its core value proposition
2. AUDIENCE: Who the target users/customers are
3. GOALS: Key metrics, KPIs, or business goals they track
4. STAGE: Product maturity (pre-launch, early, growing, mature)
5. ANALYTICS: What analytics challenges they face, what events matter

Guidelines:
- Ask ONE focused question at a time. Keep it conversational and friendly.
- Start by asking what their product does.
- Based on their answers, ask smart follow-up questions that dig deeper into gaps.
- Don't re-ask things the user already answered. Build on what you know.
- If a user gives a vague answer, ask a specific clarifying question.
- Keep responses brief (1-3 sentences max per message).
- Be encouraging and show genuine interest.

CRITICAL: You MUST end EVERY response (including your very first greeting) with a confidence tag on its own line:
CONFIDENCE:XX
Where XX is a number 0-100 representing how well you understand their business across all 5 dimensions above.
- 0-15: Know almost nothing (just started, or user said something irrelevant like "hey")
- 15-30: Know the basic product idea
- 30-50: Know product + audience OR product + goals
- 50-70: Have good understanding of 3-4 dimensions
- 70-90: Have strong understanding of all dimensions, just need minor details
- 90-100: Full context gathered, ready to summarize

A casual greeting like "hey" or "hello" should NOT increase confidence at all.

When confidence reaches 85+, respond with your final message summarizing what you learned, followed by:
CONTEXT_COMPLETE:{"product_description":"...","audience":"...","goals":"...","stage":"...","challenges":"..."}

The CONFIDENCE tag must ALWAYS be the very last line of your response.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
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
    console.error("business-context-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
