import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Get user profile with analytics keys
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_data")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const onboardingData = profile.onboarding_data as any;
    const analytics = onboardingData?.analytics;

    if (!analytics) {
      return new Response(JSON.stringify({ error: "No analytics keys configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's first project to store events in
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!projects || projects.length === 0) {
      return new Response(JSON.stringify({ error: "No project found. Create a project first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projectId = projects[0].id;

    // Use service role for inserting events (bypasses RLS)
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let fetchedEvents: any[] = [];
    let source = "";

    // --- PostHog ---
    if (analytics.posthog_personal_key && analytics.posthog_project_id) {
      source = "posthog";
      const phHost = analytics.posthog_host || "https://us.i.posthog.com";
      const projId = analytics.posthog_project_id;
      const apiKey = analytics.posthog_personal_key;

      // Use HogQL query endpoint
      const res = await fetch(`${phHost}/api/projects/${projId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: `SELECT event, distinct_id, properties, timestamp FROM events ORDER BY timestamp DESC LIMIT 500`,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("PostHog API error:", res.status, errText);
        return new Response(
          JSON.stringify({ error: `PostHog API error (${res.status}): ${errText}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const phData = await res.json();
      // HogQL returns { results: [[event, distinct_id, properties, timestamp], ...], columns: [...] }
      const rows = phData.results || [];
      fetchedEvents = rows.map((row: any[]) => ({
        project_id: projectId,
        event_name: row[0] || "unknown",
        user_identifier: row[1] || null,
        properties: typeof row[2] === "string" ? JSON.parse(row[2]) : (row[2] || {}),
        timestamp: row[3] || new Date().toISOString(),
        page_url: (typeof row[2] === "object" && row[2]?.$current_url) || null,
      }));
    }

    // --- Mixpanel ---
    if (analytics.mixpanel_secret && analytics.mixpanel_project_id && fetchedEvents.length === 0) {
      source = "mixpanel";
      const mpProjectId = analytics.mixpanel_project_id;
      const mpSecret = analytics.mixpanel_secret;

      // Fetch last 7 days
      const toDate = new Date().toISOString().split("T")[0];
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const basicAuth = btoa(`${mpSecret}:`);
      const url = `https://data.mixpanel.com/api/2.0/export?from_date=${fromDate}&to_date=${toDate}&limit=500&project_id=${mpProjectId}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "text/plain",
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Mixpanel API error:", res.status, errText);
        return new Response(
          JSON.stringify({ error: `Mixpanel API error (${res.status}): ${errText}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mixpanel returns JSONL (one JSON per line)
      const text = await res.text();
      const lines = text.trim().split("\n").filter(Boolean);
      fetchedEvents = lines.map((line: string) => {
        try {
          const ev = JSON.parse(line);
          return {
            project_id: projectId,
            event_name: ev.event || "unknown",
            user_identifier: ev.properties?.distinct_id || null,
            properties: ev.properties || {},
            timestamp: ev.properties?.time
              ? new Date(ev.properties.time * 1000).toISOString()
              : new Date().toISOString(),
            page_url: ev.properties?.$current_url || null,
          };
        } catch {
          return null;
        }
      }).filter(Boolean);
    }

    if (fetchedEvents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          source: source || "none",
          count: 0,
          message: "No events found or no valid read API keys configured. Make sure you've provided a Personal API Key (PostHog) or API Secret (Mixpanel).",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert events (upsert-like: skip duplicates by checking existing timestamps)
    const { error: insertError } = await adminSupabase.from("events").insert(fetchedEvents);

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to store events" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, source, count: fetchedEvents.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
