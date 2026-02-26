import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are ECP's onboarding assistant. Your goal is to deeply understand the user's product and business so the platform can deliver tailored event analytics insights.

## APPROACH: BOTTOM-UP UNDERSTANDING (CRITICAL)
You build understanding from concrete data upward, NOT from generic questions downward.

### Phase 1: EVENTS FIRST (if event data is provided)
- Start by analyzing the actual event names the user's product is emitting
- Group them by domain (e.g., auth events, commerce events, content events, navigation events)
- Infer what the product does from the events alone — e.g. if you see "card_flipped", "deck_created", "study_session_started", you know it's a flashcard/study app
- Present your interpretation of what each event group means in plain English
- Example: "Looking at your events, I can see your product has a study system (study_session_started, card_flipped), a content library (deck_created, deck_shared), and a paywall (paywall_shown, subscription_started). This tells me you're running a freemium learning app."

### Phase 2: CODEBASE ENRICHMENT (if repo context is provided)
- Cross-reference events with the codebase structure
- Identify what pages/screens exist from routes and components
- Understand the domain from URLs, component names, data models
- Map events to their location in the product (which page, which flow)
- Infer the product type, monetization model, target audience from code patterns
- NEVER mention technical terms like file names, extensions, hooks, or component names — describe what features DO in plain English
- Example: "Your codebase confirms this is a medical study app — you have a spaced repetition engine, a deck marketplace, user profiles with study streaks, and a subscription paywall. The main user flow goes: browse decks → start study session → flip cards → track progress."

### Phase 3: CLARIFY & CONFIRM (1-2 questions max)
- Present your full interpretation as confident statements
- Ask the user to confirm or correct SPECIFIC things you inferred
- Focus on things code/events can't tell you: the WHY behind the product
- Example: "Does that match how you think about your product? And one thing I couldn't tell from the code — are you primarily targeting med students, or broader than that?"

### Phase 4: BIG PICTURE (only after Phase 3 is confirmed)
- NOW ask about higher-level business context:
  1. What stage are you at? (pre-launch, early traction, scaling)
  2. What's your North Star metric?
  3. What's your biggest analytics blind spot?
- These questions should feel natural AFTER you've demonstrated deep product understanding

## DIMENSION TRACKING
Track understanding across these dimensions:
1. PRODUCT: What the product does, core features, user flows
2. AUDIENCE: Who the target users are
3. GOALS: Key metrics, KPIs, business goals
4. STAGE: Product maturity
5. ANALYTICS: What events matter and what insights they need

## CONVERSATION STYLE
- Talk like you're chatting with a normal person, NOT a developer
- NEVER mention file names, component names, extensions (.tsx, .ts), hooks, routes, APIs
- Describe what features DO in plain English
- Be confident and specific — show you understand their product
- Lead with YOUR interpretation, then ask to confirm

## FORMATTING
- Use bullet points (- or •) for lists
- Keep bullets crisp — one idea, max 1-2 sentences
- Structure: observation → what you know → questions for gaps
- After confirming your read, ask ONE focused follow-up about gaps

## EVENT CONTEXT USAGE
When event data is provided, you MUST:
- Reference specific events by their business meaning (not raw names)
- Group events into logical flows (onboarding, core usage, monetization, etc.)
- Identify which events are most important for the business
- Note any gaps — important flows that seem untracked

CRITICAL: You MUST end EVERY response with TWO tags on their own lines:

1. PARTIAL_CONTEXT — Include in EVERY response. Captures what you know so far.
PARTIAL_CONTEXT:{"product_description":"...or null","audience":"...or null","goals":"...or null","stage":"...or null","challenges":"...or null"}

2. CONFIDENCE:XX (0-100)
- 0-15: No context at all
- 15-25: Have events OR repo only, made initial interpretation, awaiting confirmation
- 25-45: User confirmed initial read, still missing 2-3 dimensions
- 45-65: Good understanding of product + 1-2 business dimensions
- 65-85: Strong understanding of 4-5 dimensions
- 85-100: Full context, ready to summarize

When you have events + codebase, you ALREADY know a LOT. Start at 20-30 confidence with rich PARTIAL_CONTEXT values inferred from data.

When confidence reaches 85+, respond with final summary followed by:
CONTEXT_COMPLETE:{"product_description":"...","audience":"...","goals":"...","stage":"...","challenges":"..."}

Order: message text → PARTIAL_CONTEXT → CONFIDENCE (or CONTEXT_COMPLETE → CONFIDENCE).`;

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

    // Fetch user's events for bottom-up context
    let eventContext = "";
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const sb = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          // Get user's project
          const { data: project } = await sb.from("projects").select("id").eq("user_id", user.id).single();
          if (project?.id) {
            // Fetch top events with counts
            const { data: events } = await sb.rpc("execute_readonly_query", {
              query_text: `SELECT event_name, COUNT(*) as count FROM events WHERE project_id = '${project.id}' GROUP BY event_name ORDER BY count DESC LIMIT 50`
            });
            if (events && Array.isArray(events) && events.length > 0) {
              eventContext = `\n\n## LIVE EVENT DATA\nThe user's product is currently emitting these events (sorted by frequency):\n${events.map((e: any) => `- ${e.event_name} (${e.count} occurrences)`).join("\n")}`;
            }
            // Fetch event annotations if any
            const { data: annotations } = await sb.from("event_annotations").select("event_name, description, category").eq("project_id", project.id);
            if (annotations && annotations.length > 0) {
              eventContext += `\n\n## EVENT DICTIONARY\nSome events have been annotated:\n${annotations.map((a: any) => `- ${a.event_name}: ${a.description || "no description"} (category: ${a.category || "uncategorized"})`).join("\n")}`;
            }
          }
        }
      } catch (e) {
        console.warn("Failed to fetch event context:", e);
      }
    }

    let systemPrompt = SYSTEM_PROMPT;
    if (eventContext) {
      systemPrompt += eventContext;
    }
    if (repo_context) {
      systemPrompt += `\n\n## CODEBASE CONTEXT\nThe user has connected their GitHub repository. Use this to cross-reference with events and build deeper understanding:\n\n${repo_context.slice(0, 8000)}`;
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
