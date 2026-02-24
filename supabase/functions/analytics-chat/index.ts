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

When the user asks about their data/metrics, you MUST use the query_events tool to run a SQL query.
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

// Tool definition for SQL execution
const QUERY_TOOL = {
  type: "function",
  function: {
    name: "query_events",
    description: "Execute a read-only SQL query against the user's event database. Only SELECT statements allowed.",
    parameters: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "A PostgreSQL SELECT query to run against the events/projects tables",
        },
        explanation: {
          type: "string",
          description: "Brief explanation of what this query does (shown to user)",
        },
      },
      required: ["sql", "explanation"],
      additionalProperties: false,
    },
  },
};

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    // Set up authenticated supabase client
    let supabase: any = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });
    }

    // PASS 1: Non-streaming call with tool to let AI decide if it needs SQL
    const pass1Response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        tools: [QUERY_TOOL],
        stream: false,
      }),
    });

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

    const pass1Data = await pass1Response.json();
    const choice = pass1Data.choices?.[0];
    const toolCalls = choice?.message?.tool_calls;

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
    } else if (!toolCalls) {
      // AI answered directly without tools — just include its answer as context
      const directAnswer = choice?.message?.content;
      if (directAnswer) {
        // Stream the direct answer back
        pass2Messages = [
          { role: "system", content: systemPrompt },
          ...messages,
          { role: "assistant", content: directAnswer },
          { role: "user", content: "Please repeat your previous response exactly as-is." },
        ];
      }
    }

    // PASS 2: Stream the final response
    const pass2Response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: pass2Messages,
        stream: true,
      }),
    });

    if (!pass2Response.ok) {
      const t = await pass2Response.text();
      console.error("AI pass2 error:", pass2Response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
