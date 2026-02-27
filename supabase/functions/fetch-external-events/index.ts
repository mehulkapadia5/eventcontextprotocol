import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper to create JWT from service account for Google APIs
async function createGoogleJWT(serviceAccount: any): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const headerB64 = encode(header);
  const claimB64 = encode(claim);
  const signingInput = `${headerB64}.${claimB64}`;

  const pemContent = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${sigB64}`;
}

async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await createGoogleJWT(serviceAccount);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google OAuth error (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const callerUserId = claimsData.claims.sub;

    // Check if a target_user_id was provided (admin feature)
    let targetUserId = callerUserId;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // no body is fine
    }

    if (body.target_user_id && body.target_user_id !== callerUserId) {
      // Verify caller is admin using service role
      const adminSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: isAdmin } = await adminSupabase.rpc("has_role", {
        _user_id: callerUserId,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetUserId = body.target_user_id;
    }

    // Use service role for reading target user's profile and inserting events
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("onboarding_data")
      .eq("user_id", targetUserId)
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

    // Get target user's first project (including last_synced_at)
    const { data: projects } = await adminSupabase
      .from("projects")
      .select("id, last_synced_at")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!projects || projects.length === 0) {
      return new Response(JSON.stringify({ error: "No project found for this user." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projectId = projects[0].id;
    const lastSyncedAt = projects[0].last_synced_at as string | null;

    let fetchedEvents: any[] = [];
    let source = "";
    const PAGE_SIZE = 500;

    // --- PostHog ---
    if (analytics.posthog_personal_key && analytics.posthog_project_id) {
      source = "posthog";
      const phHost = analytics.posthog_host || "https://us.i.posthog.com";
      const projId = analytics.posthog_project_id;
      const apiKey = analytics.posthog_personal_key;

      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const whereClause = lastSyncedAt
          ? `WHERE timestamp > '${lastSyncedAt}'`
          : "";
        const query = `SELECT event, distinct_id, properties, timestamp FROM events ${whereClause} ORDER BY timestamp DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}`;

        const res = await fetch(`${phHost}/api/projects/${projId}/query`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
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
        const rows = phData.results || [];
        const mapped = rows.map((row: any[]) => ({
          project_id: projectId,
          event_name: row[0] || "unknown",
          user_identifier: row[1] || null,
          properties: typeof row[2] === "string" ? JSON.parse(row[2]) : (row[2] || {}),
          timestamp: row[3] || new Date().toISOString(),
          page_url: (typeof row[2] === "object" && row[2]?.$current_url) || null,
        }));
        fetchedEvents.push(...mapped);

        hasMore = rows.length >= PAGE_SIZE;
        offset += PAGE_SIZE;
      }
    }

    // --- Mixpanel ---
    if (analytics.mixpanel_secret && analytics.mixpanel_project_id && fetchedEvents.length === 0) {
      source = "mixpanel";
      const mpProjectId = analytics.mixpanel_project_id;
      const mpSecret = analytics.mixpanel_secret;

      const toDate = new Date().toISOString().split("T")[0];
      const fromDate = lastSyncedAt
        ? lastSyncedAt.split("T")[0]
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const basicAuth = btoa(`${mpSecret}:`);
      const url = `https://data.mixpanel.com/api/2.0/export?from_date=${fromDate}&to_date=${toDate}&project_id=${mpProjectId}`;

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

    // --- Google Analytics 4 ---
    if (analytics.ga_property_id && analytics.ga_service_account_json && fetchedEvents.length === 0) {
      source = "google_analytics";
      try {
        const serviceAccount = JSON.parse(analytics.ga_service_account_json);
        const accessToken = await getGoogleAccessToken(serviceAccount);
        const propertyId = analytics.ga_property_id;

        const toDate = new Date().toISOString().split("T")[0];
        const fromDate = lastSyncedAt
          ? lastSyncedAt.split("T")[0]
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const gaRes = await fetch(
          `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: fromDate, endDate: toDate }],
              dimensions: [
                { name: "eventName" },
                { name: "date" },
                { name: "pagePathPlusQueryString" },
              ],
              metrics: [
                { name: "eventCount" },
                { name: "totalUsers" },
              ],
              limit: 500,
              orderBys: [{ dimension: { dimensionName: "date", orderType: "ALPHANUMERIC" }, desc: true }],
            }),
          }
        );

        if (!gaRes.ok) {
          const errText = await gaRes.text();
          console.error("GA4 API error:", gaRes.status, errText);
          return new Response(
            JSON.stringify({ error: `Google Analytics API error (${gaRes.status}): ${errText}` }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const gaData = await gaRes.json();
        const gaRows = gaData.rows || [];

        fetchedEvents = gaRows.map((row: any) => {
          const eventName = row.dimensionValues?.[0]?.value || "unknown";
          const dateStr = row.dimensionValues?.[1]?.value || "";
          const pagePath = row.dimensionValues?.[2]?.value || null;
          const eventCount = parseInt(row.metricValues?.[0]?.value || "1", 10);
          const totalUsers = parseInt(row.metricValues?.[1]?.value || "0", 10);

          const year = dateStr.slice(0, 4);
          const month = dateStr.slice(4, 6);
          const day = dateStr.slice(6, 8);
          const timestamp = dateStr ? `${year}-${month}-${day}T00:00:00Z` : new Date().toISOString();

          return {
            project_id: projectId,
            event_name: eventName,
            user_identifier: null,
            properties: {
              source: "google_analytics",
              event_count: eventCount,
              total_users: totalUsers,
            },
            timestamp,
            page_url: pagePath,
          };
        });
      } catch (gaErr) {
        console.error("GA4 processing error:", gaErr);
        return new Response(
          JSON.stringify({ error: `Google Analytics error: ${gaErr instanceof Error ? gaErr.message : "Unknown error"}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // --- Supabase DB ---
    if (analytics.supabase_url && analytics.supabase_anon_key && fetchedEvents.length === 0) {
      source = "supabase";
      try {
        const extSupabase = createClient(analytics.supabase_url, analytics.supabase_anon_key);
        const tableName = analytics.supabase_table || "events";

        let query = extSupabase
          .from(tableName)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);

        if (lastSyncedAt) {
          query = query.gt("created_at", lastSyncedAt);
        }

        const { data: extEvents, error: extError } = await query;

        if (extError) {
          console.error("Supabase external DB error:", extError);
          return new Response(
            JSON.stringify({ error: `Supabase DB error: ${extError.message}` }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (extEvents && extEvents.length > 0) {
          fetchedEvents = extEvents.map((ev: any) => ({
            project_id: projectId,
            event_name: ev.event_name || ev.name || ev.event || ev.type || "unknown",
            user_identifier: ev.user_identifier || ev.user_id || ev.distinct_id || ev.userId || null,
            properties: ev.properties || ev.metadata || ev.data || {},
            timestamp: ev.timestamp || ev.created_at || ev.occurred_at || new Date().toISOString(),
            page_url: ev.page_url || ev.url || (ev.properties && ev.properties.$current_url) || null,
          }));
        }
      } catch (sbErr) {
        console.error("Supabase external DB error:", sbErr);
        return new Response(
          JSON.stringify({ error: `Supabase DB error: ${sbErr instanceof Error ? sbErr.message : "Unknown error"}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (fetchedEvents.length === 0) {
      // Still update last_synced_at even if no new events
      await adminSupabase.from("projects").update({ last_synced_at: new Date().toISOString() }).eq("id", projectId);
      return new Response(
        JSON.stringify({
          success: true,
          source: source || "none",
          count: 0,
          message: "No new events found.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert with deduplication
    const { error: insertError } = await adminSupabase
      .from("events")
      .upsert(fetchedEvents, {
        onConflict: "project_id,event_name,user_identifier,timestamp",
        ignoreDuplicates: true,
      });

    if (insertError) {
      console.error("Upsert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to store events" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last_synced_at
    await adminSupabase
      .from("projects")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", projectId);

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
