import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAGE_SIZE = 500; // events per page from external APIs
const MAX_PAGES = 20; // safety cap: 10,000 events max per sync
const BATCH_INSERT_SIZE = 200; // insert in chunks to avoid timeouts

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

// Get or create sync cursor for a project/source
async function getSyncCursor(adminSupabase: any, projectId: string, source: string) {
  const { data } = await adminSupabase
    .from("sync_cursors")
    .select("*")
    .eq("project_id", projectId)
    .eq("source", source)
    .single();
  return data;
}

async function upsertSyncCursor(
  adminSupabase: any,
  projectId: string,
  source: string,
  lastEventTimestamp: string | null,
  newEventsCount: number,
  metadata: any = {}
) {
  const { data: existing } = await adminSupabase
    .from("sync_cursors")
    .select("id, total_synced")
    .eq("project_id", projectId)
    .eq("source", source)
    .single();

  if (existing) {
    await adminSupabase
      .from("sync_cursors")
      .update({
        last_synced_at: new Date().toISOString(),
        last_event_timestamp: lastEventTimestamp,
        total_synced: (existing.total_synced || 0) + newEventsCount,
        metadata,
      })
      .eq("id", existing.id);
  } else {
    await adminSupabase.from("sync_cursors").insert({
      project_id: projectId,
      source,
      last_synced_at: new Date().toISOString(),
      last_event_timestamp: lastEventTimestamp,
      total_synced: newEventsCount,
      metadata,
    });
  }
}

// Batch insert with dedup - uses ON CONFLICT DO NOTHING via raw SQL
async function batchInsertEvents(adminSupabase: any, events: any[]): Promise<number> {
  let inserted = 0;

  for (let i = 0; i < events.length; i += BATCH_INSERT_SIZE) {
    const batch = events.slice(i, i + BATCH_INSERT_SIZE);

    // Use upsert with ignoreDuplicates to skip existing events
    const { error, count } = await adminSupabase
      .from("events")
      .upsert(batch, {
        onConflict: "project_id,event_name,timestamp,user_identifier",
        ignoreDuplicates: true,
        count: "exact",
      });

    if (error) {
      // If upsert with onConflict fails (constraint may not match), fall back to insert
      console.warn("Upsert failed, falling back to insert:", error.message);
      const { error: insertError } = await adminSupabase.from("events").insert(batch);
      if (insertError) {
        console.error("Batch insert error:", insertError);
        // Continue with next batch rather than failing entirely
        continue;
      }
      inserted += batch.length;
    } else {
      inserted += count ?? batch.length;
    }
  }

  return inserted;
}

// --- PostHog paginated fetch ---
async function fetchPostHogEvents(
  analytics: any,
  projectId: string,
  cursor: any | null
): Promise<{ events: any[]; source: string; lastTimestamp: string | null }> {
  const phHost = analytics.posthog_host || "https://us.i.posthog.com";
  const projId = analytics.posthog_project_id;
  const apiKey = analytics.posthog_personal_key;

  // Use cursor to only fetch events newer than last sync
  const afterClause = cursor?.last_event_timestamp
    ? `WHERE timestamp > '${cursor.last_event_timestamp}'`
    : "";

  let allEvents: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore && offset / PAGE_SIZE < MAX_PAGES) {
    const query = `SELECT event, distinct_id, properties, timestamp FROM events ${afterClause} ORDER BY timestamp DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}`;

    const res = await fetch(`${phHost}/api/projects/${projId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { kind: "HogQLQuery", query },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`PostHog API error (${res.status}): ${errText}`);
    }

    const phData = await res.json();
    const rows = phData.results || [];

    const pageEvents = rows.map((row: any[]) => ({
      project_id: projectId,
      event_name: row[0] || "unknown",
      user_identifier: row[1] || null,
      properties: typeof row[2] === "string" ? JSON.parse(row[2]) : (row[2] || {}),
      timestamp: row[3] || new Date().toISOString(),
      page_url: (typeof row[2] === "object" && row[2]?.$current_url) || null,
    }));

    allEvents = allEvents.concat(pageEvents);
    console.log(`PostHog page ${offset / PAGE_SIZE + 1}: ${rows.length} events`);

    if (rows.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  const lastTimestamp = allEvents.length > 0
    ? allEvents.reduce((max, e) => e.timestamp > max ? e.timestamp : max, allEvents[0].timestamp)
    : null;

  return { events: allEvents, source: "posthog", lastTimestamp };
}

// --- Mixpanel paginated fetch ---
async function fetchMixpanelEvents(
  analytics: any,
  projectId: string,
  cursor: any | null
): Promise<{ events: any[]; source: string; lastTimestamp: string | null }> {
  const mpProjectId = analytics.mixpanel_project_id;
  const mpSecret = analytics.mixpanel_secret;

  // Use cursor to narrow date range - fetch from last sync or last 30 days
  const toDate = new Date().toISOString().split("T")[0];
  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const fromDate = cursor?.last_event_timestamp
    ? new Date(cursor.last_event_timestamp).toISOString().split("T")[0]
    : defaultFrom.toISOString().split("T")[0];

  const basicAuth = btoa(`${mpSecret}:`);
  let allEvents: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && page < MAX_PAGES) {
    const url = `https://data.mixpanel.com/api/2.0/export?from_date=${fromDate}&to_date=${toDate}&limit=${PAGE_SIZE}&page=${page}&project_id=${mpProjectId}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "text/plain",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Mixpanel API error (${res.status}): ${errText}`);
    }

    const text = await res.text();
    const lines = text.trim().split("\n").filter(Boolean);

    const pageEvents = lines.map((line: string) => {
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

    allEvents = allEvents.concat(pageEvents);
    console.log(`Mixpanel page ${page + 1}: ${pageEvents.length} events`);

    if (pageEvents.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      page++;
    }
  }

  const lastTimestamp = allEvents.length > 0
    ? allEvents.reduce((max, e) => e.timestamp > max ? e.timestamp : max, allEvents[0].timestamp)
    : null;

  return { events: allEvents, source: "mixpanel", lastTimestamp };
}

// --- GA4 paginated fetch ---
async function fetchGA4Events(
  analytics: any,
  projectId: string,
  cursor: any | null
): Promise<{ events: any[]; source: string; lastTimestamp: string | null }> {
  const serviceAccount = JSON.parse(analytics.ga_service_account_json);
  const accessToken = await getGoogleAccessToken(serviceAccount);
  const propertyId = analytics.ga_property_id;

  const toDate = new Date().toISOString().split("T")[0];
  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const fromDate = cursor?.last_event_timestamp
    ? new Date(cursor.last_event_timestamp).toISOString().split("T")[0]
    : defaultFrom.toISOString().split("T")[0];

  let allEvents: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore && offset / PAGE_SIZE < MAX_PAGES) {
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
          limit: PAGE_SIZE,
          offset,
          orderBys: [{ dimension: { dimensionName: "date", orderType: "ALPHANUMERIC" }, desc: true }],
        }),
      }
    );

    if (!gaRes.ok) {
      const errText = await gaRes.text();
      throw new Error(`Google Analytics API error (${gaRes.status}): ${errText}`);
    }

    const gaData = await gaRes.json();
    const gaRows = gaData.rows || [];

    const pageEvents = gaRows.map((row: any) => {
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

    allEvents = allEvents.concat(pageEvents);
    console.log(`GA4 page ${offset / PAGE_SIZE + 1}: ${gaRows.length} events`);

    if (gaRows.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  const lastTimestamp = allEvents.length > 0
    ? allEvents.reduce((max, e) => e.timestamp > max ? e.timestamp : max, allEvents[0].timestamp)
    : null;

  return { events: allEvents, source: "google_analytics", lastTimestamp };
}

// --- Supabase DB paginated fetch ---
async function fetchSupabaseEvents(
  analytics: any,
  projectId: string,
  cursor: any | null
): Promise<{ events: any[]; source: string; lastTimestamp: string | null }> {
  const extSupabase = createClient(analytics.supabase_url, analytics.supabase_anon_key);
  const tableName = analytics.supabase_table || "events";

  let allEvents: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore && offset / PAGE_SIZE < MAX_PAGES) {
    let query = extSupabase
      .from(tableName)
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    // If we have a cursor, only fetch newer events
    if (cursor?.last_event_timestamp) {
      query = query.gt("created_at", cursor.last_event_timestamp);
    }

    const { data: extEvents, error: extError } = await query;

    if (extError) {
      throw new Error(`Supabase DB error: ${extError.message}`);
    }

    if (extEvents && extEvents.length > 0) {
      const pageEvents = extEvents.map((ev: any) => ({
        project_id: projectId,
        event_name: ev.event_name || ev.name || ev.event || ev.type || "unknown",
        user_identifier: ev.user_identifier || ev.user_id || ev.distinct_id || ev.userId || null,
        properties: ev.properties || ev.metadata || ev.data || {},
        timestamp: ev.timestamp || ev.created_at || ev.occurred_at || new Date().toISOString(),
        page_url: ev.page_url || ev.url || (ev.properties && ev.properties.$current_url) || null,
      }));

      allEvents = allEvents.concat(pageEvents);
      console.log(`Supabase page ${offset / PAGE_SIZE + 1}: ${extEvents.length} events`);

      if (extEvents.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    } else {
      hasMore = false;
    }
  }

  const lastTimestamp = allEvents.length > 0
    ? allEvents.reduce((max, e) => e.timestamp > max ? e.timestamp : max, allEvents[0].timestamp)
    : null;

  return { events: allEvents, source: "supabase", lastTimestamp };
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

    // Get target user's first project
    const { data: projects } = await adminSupabase
      .from("projects")
      .select("id")
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

    // Determine source and fetch with pagination + cursor
    let result: { events: any[]; source: string; lastTimestamp: string | null } = {
      events: [],
      source: "none",
      lastTimestamp: null,
    };

    if (analytics.posthog_personal_key && analytics.posthog_project_id) {
      const cursor = await getSyncCursor(adminSupabase, projectId, "posthog");
      console.log(`PostHog sync starting. Cursor: ${cursor?.last_event_timestamp || "none"}`);
      result = await fetchPostHogEvents(analytics, projectId, cursor);
    } else if (analytics.mixpanel_secret && analytics.mixpanel_project_id) {
      const cursor = await getSyncCursor(adminSupabase, projectId, "mixpanel");
      console.log(`Mixpanel sync starting. Cursor: ${cursor?.last_event_timestamp || "none"}`);
      result = await fetchMixpanelEvents(analytics, projectId, cursor);
    } else if (analytics.ga_property_id && analytics.ga_service_account_json) {
      const cursor = await getSyncCursor(adminSupabase, projectId, "google_analytics");
      console.log(`GA4 sync starting. Cursor: ${cursor?.last_event_timestamp || "none"}`);
      result = await fetchGA4Events(analytics, projectId, cursor);
    } else if (analytics.supabase_url && analytics.supabase_anon_key) {
      const cursor = await getSyncCursor(adminSupabase, projectId, "supabase");
      console.log(`Supabase sync starting. Cursor: ${cursor?.last_event_timestamp || "none"}`);
      result = await fetchSupabaseEvents(analytics, projectId, cursor);
    }

    if (result.events.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          source: result.source,
          count: 0,
          message: "No new events found. Already up to date.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch insert with dedup
    console.log(`Inserting ${result.events.length} events in batches of ${BATCH_INSERT_SIZE}...`);
    const insertedCount = await batchInsertEvents(adminSupabase, result.events);
    console.log(`Inserted ${insertedCount} events (${result.events.length - insertedCount} duplicates skipped)`);

    // Update sync cursor
    await upsertSyncCursor(
      adminSupabase,
      projectId,
      result.source,
      result.lastTimestamp,
      insertedCount,
      { pages_fetched: Math.ceil(result.events.length / PAGE_SIZE) }
    );

    return new Response(
      JSON.stringify({
        success: true,
        source: result.source,
        count: insertedCount,
        fetched: result.events.length,
        duplicates_skipped: result.events.length - insertedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
