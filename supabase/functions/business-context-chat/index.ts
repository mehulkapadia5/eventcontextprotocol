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

## CODEBASE-FIRST APPROACH (CRITICAL)
If the user has connected a GitHub repository and you have codebase context available:
- DO NOT ask generic open-ended questions like "What does your product do?"
- Instead, ANALYZE the codebase context and LEAD with your own interpretation
- Present what you've inferred as confident statements, then ask the user to confirm or correct
- Example: "From your codebase, I can see you're building a medical flashcard app with an Anki-style spaced repetition system targeting med students. You have a freemium model with a PaywallModal component. Does that sound right, or should I adjust anything?"
- This makes the user feel like the AI "gets it" immediately
- You can infer: tech stack, product type, monetization model, target audience, key features, data models
- Look at file names, component names, route structures, API endpoints, package.json, etc.

If NO codebase context is available, fall back to conversational questions but still try to be specific based on any context clues.

## CONVERSATION STYLE
- Be confident and specific, not vague
- Present your interpretation FIRST, then ask to confirm — never ask "what does your product do?" when you can see the code
- Keep responses brief (2-4 sentences max per message)
- After confirming your initial read, ask ONE focused follow-up about gaps (goals, stage, challenges)
- Build on what you know, don't re-ask

CRITICAL: You MUST end EVERY response (including your very first greeting) with a confidence tag on its own line:
CONFIDENCE:XX
Where XX is a number 0-100 representing how well you understand their business across all 5 dimensions above.
- 0-15: Know almost nothing (just started, no repo context, user said something irrelevant)
- 15-40: Have repo context, made initial interpretation, awaiting confirmation
- 40-60: User confirmed product basics, know product + audience OR goals
- 60-80: Have good understanding of 3-4 dimensions
- 80-90: Have strong understanding of all dimensions, just need minor details
- 90-100: Full context gathered, ready to summarize

When you have repo context and make your first interpretation, start at 15-30 (you've inferred but not confirmed).
A casual greeting like "hey" or "hello" should NOT increase confidence at all.

When confidence reaches 85+, respond with your final message summarizing what you learned, followed by:
CONTEXT_COMPLETE:{"product_description":"...","audience":"...","goals":"...","stage":"...","challenges":"..."}

The CONFIDENCE tag must ALWAYS be the very last line of your response.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, repo_context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = SYSTEM_PROMPT;
    if (repo_context) {
      systemPrompt += `\n\nThe user has connected their GitHub repository. Here is context about their codebase that you should use to ask smarter, more relevant questions:\n\n${repo_context.slice(0, 8000)}`;
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
    console.error("business-context-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
