import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
- Talk like you're chatting with a normal person, NOT a developer or PM
- NEVER mention technical terms like file names, component names, extensions (.tsx, .ts, .js), hooks, routes, APIs, etc.
- Instead, describe what a feature DOES in plain English. For example:
  - DON'T say "your useProgress.ts and AnkiStudy.tsx components" 
  - DO say "your study progress tracker and flashcard review system"
  - DON'T say "PaywallModal component"
  - DO say "your upgrade/payment screen"
  - DON'T say "VaultSystem route"
  - DO say "the card collection feature"
- Be confident and specific, not vague
- Present your interpretation FIRST, then ask to confirm — never ask "what does your product do?" when you can see the code
- Keep responses brief (2-4 sentences max per message)
- After confirming your initial read, ask ONE focused follow-up about gaps (goals, stage, challenges)
- Build on what you know, don't re-ask

CRITICAL: You MUST end EVERY response (including your very first greeting) with a confidence tag on its own line:
CONFIDENCE:XX
Where XX is a number 0-100 representing how well you understand their business across all 5 dimensions above.
- 0-15: Know almost nothing (just started, no context at all)
- 15-30: Have repo context only, made initial interpretation, awaiting any user input
- 30-50: User provided some info but missing 2-3 dimensions
- 50-70: Have good understanding of 3 dimensions
- 70-85: Have strong understanding of 4-5 dimensions
- 85-100: Full context gathered across all dimensions, ready to summarize

IMPORTANT: If the user provides comprehensive information covering most dimensions in a single message, jump confidence accordingly. Don't artificially hold it low just because it's early in the conversation. Judge confidence purely by how many dimensions you actually understand.
A casual greeting like "hey" or "hello" should NOT increase confidence at all.

When confidence reaches 85+, respond with your final message summarizing what you learned, followed by:
CONTEXT_COMPLETE:{"product_description":"...","audience":"...","goals":"...","stage":"...","challenges":"..."}

The CONFIDENCE tag must ALWAYS be the very last line of your response.`;

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
        if (config.openai_key) return {
          url: "https://api.openai.com/v1/chat/completions",
          apiKey: config.openai_key,
          model: config.model || "gpt-4o-mini",
          isAnthropic: false,
        };
        break;
      case "anthropic":
        if (config.anthropic_key) return {
          url: "https://api.anthropic.com/v1/messages",
          apiKey: config.anthropic_key,
          model: config.model || "claude-sonnet-4-20250514",
          isAnthropic: true,
        };
        break;
      case "google":
        if (config.google_key) {
          const model = config.model || "gemini-2.5-flash";
          return {
            url: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
            apiKey: config.google_key,
            model,
            isAnthropic: false,
          };
        }
        break;
    }
  }
  // Fallback to Lovable AI Gateway
  return {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    apiKey: Deno.env.get("LOVABLE_API_KEY") || "",
    model: "google/gemini-3-flash-preview",
    isAnthropic: false,
  };
}

async function getUserLlmConfig(req: Request): Promise<LlmConfig | undefined> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return undefined;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return undefined;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_data")
      .eq("user_id", user.id)
      .single();
    return (profile?.onboarding_data as any)?.llm_config as LlmConfig | undefined;
  } catch {
    return undefined;
  }
}

async function callAI(endpoint: ReturnType<typeof getAIEndpoint>, systemPrompt: string, messages: any[]): Promise<Response> {
  if (endpoint.isAnthropic) {
    // Anthropic uses a different API format
    const anthropicMessages = messages.map((m: any) => ({
      role: m.role === "system" ? "user" : m.role,
      content: m.content,
    }));
    const resp = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "x-api-key": endpoint.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: endpoint.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: anthropicMessages,
        stream: true,
      }),
    });
    return resp;
  }

  // OpenAI-compatible (OpenAI, Google, Lovable Gateway)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (endpoint.url.includes("googleapis.com")) {
    headers["Authorization"] = `Bearer ${endpoint.apiKey}`;
  } else {
    headers["Authorization"] = `Bearer ${endpoint.apiKey}`;
  }

  return fetch(endpoint.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: endpoint.model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, repo_context } = await req.json();
    
    // Get user's LLM config
    const llmConfig = await getUserLlmConfig(req);
    const endpoint = getAIEndpoint(llmConfig);
    
    if (!endpoint.apiKey) throw new Error("No API key configured");

    let systemPrompt = SYSTEM_PROMPT;
    if (repo_context) {
      systemPrompt += `\n\nThe user has connected their GitHub repository. Here is context about their codebase that you should use to ask smarter, more relevant questions:\n\n${repo_context.slice(0, 8000)}`;
    }

    const response = await callAI(endpoint, systemPrompt, messages);

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
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For Anthropic, we need to transform the SSE format
    if (endpoint.isAnthropic) {
      // Transform Anthropic SSE to OpenAI-compatible SSE
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      
      const stream = new ReadableStream({
        async start(controller) {
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                break;
              }
              buffer += decoder.decode(value, { stream: true });
              let newlineIndex;
              while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.slice(6);
                try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                    const openaiChunk = {
                      choices: [{ index: 0, delta: { content: parsed.delta.text } }],
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                  }
                } catch { /* skip */ }
              }
            }
          } catch (e) {
            controller.error(e);
          }
        },
      });
      
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
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
