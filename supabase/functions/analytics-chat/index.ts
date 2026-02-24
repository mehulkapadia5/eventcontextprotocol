import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are ECP's analytics assistant. You have deep knowledge of the user's business AND access to their real event data.

Your capabilities:
- Answer questions about the user's actual metrics (DAU, MAU, event counts, top events, etc.)
- Help users understand what events to track and why
- Suggest event naming conventions and taxonomy
- Explain analytics concepts (funnels, cohorts, retention, etc.)
- Help interpret what metrics mean for their specific business
- Suggest KPIs and dashboards relevant to their product
- Help with PostHog and Mixpanel query strategies
- Advise on event properties and user identification

Guidelines:
- When the user asks for numbers/metrics, USE THE EVENT DATA PROVIDED to give real answers
- Be concise but thorough (2-5 sentences per response usually)
- Use the business context provided to give tailored, specific advice
- Reference their actual product, audience, and goals when relevant
- If they ask about something outside analytics, gently redirect
- Use markdown formatting for lists, code blocks, and emphasis
- Be practical — give actionable advice, not just theory
- If event data is empty or missing, say so honestly and suggest they start tracking

## RICH WIDGETS
When presenting data, use these special code blocks to render visual widgets in the chat:

### Funnel Widget
Use when showing conversion funnels or step-by-step flows:
\`\`\`funnel
{"title":"Free to Paid Funnel","steps":[{"label":"Sessions","value":42},{"label":"Module View","value":18},{"label":"Paywall Hit","value":5},{"label":"Conversion","value":1}]}
\`\`\`

### Metrics Widget
Use when showing key metrics (DAU, MAU, totals, etc.):
\`\`\`metrics
{"metrics":[{"label":"DAU Today","value":12,"change":25},{"label":"MAU","value":89},{"label":"Total Events","value":1250,"change":-3},{"label":"Unique Users","value":45}]}
\`\`\`

### Top Events Widget
Use when showing ranked event lists:
\`\`\`top-events
{"title":"Top Events (7d)","events":[{"name":"page_view","count":340,"users":28},{"name":"card_reviewed","count":120,"users":15},{"name":"search_performed","count":85,"users":22}]}
\`\`\`

ALWAYS use these widgets when presenting quantitative data. You can mix widgets with regular markdown text. Use real numbers from the event data provided.`;

async function fetchEventStats(supabase: any, userId: string) {
  // Get user's projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", userId);

  if (!projects || projects.length === 0) return null;

  const projectIds = projects.map((p: any) => p.id);

  // Get total events count
  const { count: totalEvents } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .in("project_id", projectIds);

  // Get recent events for analysis (last 1000)
  const { data: recentEvents } = await supabase
    .from("events")
    .select("event_name, user_identifier, timestamp, page_url, properties")
    .in("project_id", projectIds)
    .order("timestamp", { ascending: false })
    .limit(1000);

  if (!recentEvents || recentEvents.length === 0) {
    return { projects, totalEvents: totalEvents || 0, summary: "No events recorded yet." };
  }

  // Compute stats
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split("T")[0];

  const uniqueUsersToday = new Set(
    recentEvents.filter((e: any) => e.timestamp.startsWith(today)).map((e: any) => e.user_identifier).filter(Boolean)
  ).size;

  const uniqueUsersYesterday = new Set(
    recentEvents.filter((e: any) => e.timestamp.startsWith(yesterday)).map((e: any) => e.user_identifier).filter(Boolean)
  ).size;

  // DAU for last 7 days
  const dau: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().split("T")[0];
    dau[d] = new Set(
      recentEvents.filter((e: any) => e.timestamp.startsWith(d)).map((e: any) => e.user_identifier).filter(Boolean)
    ).size;
  }

  // MAU (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const mau = new Set(
    recentEvents.filter((e: any) => new Date(e.timestamp) >= thirtyDaysAgo).map((e: any) => e.user_identifier).filter(Boolean)
  ).size;

  // Top events
  const eventCounts: Record<string, number> = {};
  recentEvents.forEach((e: any) => {
    eventCounts[e.event_name] = (eventCounts[e.event_name] || 0) + 1;
  });
  const topEvents = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Events today
  const eventsToday = recentEvents.filter((e: any) => e.timestamp.startsWith(today)).length;

  const allUniqueUsers = new Set(recentEvents.map((e: any) => e.user_identifier).filter(Boolean)).size;

  return {
    projects: projects.map((p: any) => p.name),
    totalEvents,
    eventsToday,
    dauToday: uniqueUsersToday,
    dauYesterday: uniqueUsersYesterday,
    dauLast7Days: dau,
    mau,
    allUniqueUsers,
    topEvents,
    oldestEvent: recentEvents[recentEvents.length - 1]?.timestamp,
    newestEvent: recentEvents[0]?.timestamp,
  };
}

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

    // Fetch real event data if we have auth
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const stats = await fetchEventStats(supabase, user.id);
          if (stats) {
            systemPrompt += `\n\n## REAL EVENT DATA (from user's database)\n\`\`\`json\n${JSON.stringify(stats, null, 2)}\n\`\`\`\nUse this data to answer metric questions with REAL numbers. Do not say "I don't have access to your data" — you DO have it above.`;
          }
        }
      } catch (e) {
        console.warn("Failed to fetch event stats:", e);
      }
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
