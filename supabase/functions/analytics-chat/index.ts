import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QUERY_TOOL = {
  type: "function",
  function: {
    name: "query_events",
    description: "Execute a read-only SQL query against the user's event database to answer data questions.",
    parameters: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "A valid PostgreSQL SELECT or WITH...SELECT query to run against the events table.",
        },
      },
      required: ["sql"],
    },
  },
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
- created_at (timestamptz)
- updated_at (timestamptz)

NOTES:
- Always filter events by project_id IN (user's project IDs) — RLS handles this automatically
- Use timestamp for time-based queries, not created_at
- properties is JSONB — use properties->>'key' or properties->'key' for access
- user_identifier is how end-users are tracked (can be email, ID, etc.)
- Common event_names depend on the user's product
`;

const SYSTEM_PROMPT = `You are ECP's analytics assistant. You have deep knowledge of the user's business AND can execute real SQL queries against their event database.

Your capabilities:
- Execute SQL queries against the user's actual event data
- Answer questions about real metrics (DAU, MAU, funnels, retention, etc.)
- Help users understand their analytics
- Suggest event naming conventions and tracking strategies

## HOW TO ANSWER DATA QUESTIONS

IMPORTANT: Before running any query, ALWAYS explain your plan first:
1. State which events/steps you'll use and why
2. Describe the query approach (e.g. "I'll build a funnel with these steps: X → Y → Z")
3. Ask the user to confirm the plan looks right OR proceed if you're confident
4. THEN run the query

When the user asks about their data/metrics, use the query_events tool to run a SQL query.
- Write efficient PostgreSQL queries
- Always use the schema provided
- For time ranges, use timestamp column with intervals like: timestamp >= now() - interval '7 days'
- For DAU: COUNT(DISTINCT user_identifier) grouped by date
- For funnels: use conditional aggregation or CTEs
- Limit results to reasonable amounts (LIMIT 100 max)
- ONLY write SELECT or WITH...SELECT queries

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
- Be concise but thorough
- Use business context to give tailored advice
- Use markdown formatting
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
  return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: Deno.env.get("LOVABLE_API_KEY") || "", model: "openai/gpt-5-mini", isAnthropic: false };
}

async function callAIWithTools(endpoint: ReturnType<typeof getAIEndpoint>, messages: any[], tools?: any[], stream = false) {
  if (endpoint.isAnthropic) {
    const systemMsg = messages.find((m: any) => m.role === "system");
    const nonSystemMsgs = messages.filter((m: any) => m.role !== "system");
    const body: any = {
      model: endpoint.model,
      max_tokens: 4096,
      system: systemMsg?.content || "",
      messages: nonSystemMsgs,
      stream,
    };
    if (tools && !stream) {
      body.tools = tools.map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }
    return fetch(endpoint.url, {
      method: "POST",
      headers: { "x-api-key": endpoint.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const body: any = { model: endpoint.model, messages, stream };
  if (tools && !stream) { body.tools = tools; }
  return fetch(endpoint.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${endpoint.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

    // PASS 1: Non-streaming call with tool to let AI decide if it needs SQL
    const pass1Response = await callAIWithTools(
      endpoint,
      [{ role: "system", content: systemPrompt }, ...messages],
      endpoint.isAnthropic ? undefined : [QUERY_TOOL],
      false
    );

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

    let pass1Data: any;
    const contentType = pass1Response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      // Gateway returned SSE even for non-streaming — collect the full text
      const sseText = await pass1Response.text();
      const lines = sseText.split("\n").filter(l => l.startsWith("data: ") && !l.includes("[DONE]"));
      // Reconstruct from SSE chunks
      let fullContent = "";
      let toolCallsFromSSE: any[] | undefined;
      let finishReasonSSE: string | null = null;
      for (const line of lines) {
        try {
          const chunk = JSON.parse(line.slice(6));
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) fullContent += delta.content;
          if (delta?.tool_calls) {
            if (!toolCallsFromSSE) toolCallsFromSSE = [];
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCallsFromSSE[tc.index]) toolCallsFromSSE[tc.index] = { id: tc.id, function: { name: "", arguments: "" } };
                if (tc.id) toolCallsFromSSE[tc.index].id = tc.id;
                if (tc.function?.name) toolCallsFromSSE[tc.index].function.name += tc.function.name;
                if (tc.function?.arguments) toolCallsFromSSE[tc.index].function.arguments += tc.function.arguments;
              }
            }
          }
          if (chunk.choices?.[0]?.finish_reason) finishReasonSSE = chunk.choices[0].finish_reason;
        } catch { /* skip malformed lines */ }
      }
      pass1Data = {
        choices: [{
          message: {
            role: "assistant",
            content: fullContent || null,
            tool_calls: toolCallsFromSSE?.length ? toolCallsFromSSE : undefined,
          },
          finish_reason: finishReasonSSE,
        }],
      };
    } else {
      pass1Data = await pass1Response.json();
    }
    const choice = pass1Data.choices?.[0];
    const toolCalls = choice?.message?.tool_calls;
    const finishReason = choice?.finish_reason;

    // If AI didn't call a tool, it answered directly — stream that as pass 2
    let pass2Messages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    if (toolCalls && toolCalls.length > 0 && supabase) {
      // Execute all tool calls
      const toolResults: any[] = [];
      for (const tc of toolCalls) {
        if (tc.function.name === "query_events") {
          const args = JSON.parse(tc.function.arguments);
          console.log("Executing SQL:", args.sql);
          const result = await executeQuery(supabase, args.sql);
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result.error ? { error: result.error } : { rows: result.data, count: result.data?.length || 0 }),
          });
        }
      }

      // Build pass 2 messages with tool results
      pass2Messages = [
        { role: "system", content: systemPrompt },
        ...messages,
        choice.message, // assistant message with tool_calls
        ...toolResults,
      ];
    } else if (!toolCalls && choice?.message?.content) {
      // AI answered directly without tools — return it immediately as SSE
      const directAnswer = choice.message.content;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: directAnswer } }] })}\n\n`
            )
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } else if (finishReason === "error" || (!toolCalls && !choice?.message?.content)) {
      // Tool call was malformed or empty response — retry without tools
      console.log("Pass 1 failed (reason:", finishReason, "), retrying without tools");
      pass2Messages = [
        { role: "system", content: systemPrompt + "\n\nIMPORTANT: You cannot call tools right now. If you need data, write the SQL query in your response wrapped in a ```sql code block and explain what it would show. Answer the user's question as best you can with the context you have." },
        ...messages,
      ];
    }

    // PASS 2: Stream the final response
    console.log("Pass 2: sending", pass2Messages.length, "messages, roles:", pass2Messages.map((m: any) => m.role).join(","));
    const pass2Response = await callAIWithTools(endpoint, pass2Messages, undefined, true);

    if (!pass2Response.ok) {
      const t = await pass2Response.text();
      console.error("AI pass2 error:", pass2Response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For Anthropic, transform SSE format
    if (endpoint.isAnthropic) {
      const reader = pass2Response.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
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
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    return new Response(pass2Response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analytics-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
