import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractSnippets(content: string, eventName: string): Array<{ line_number: number; code_snippet: string; surrounding_context: string }> {
  const lines = content.split("\n");
  const results: Array<{ line_number: number; code_snippet: string; surrounding_context: string }> = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(eventName)) {
      const snippetStart = Math.max(0, i - 10);
      const snippetEnd = Math.min(lines.length, i + 11);
      const contextStart = Math.max(0, i - 30);
      const contextEnd = Math.min(lines.length, i + 31);
      
      results.push({
        line_number: i + 1,
        code_snippet: lines.slice(snippetStart, snippetEnd).join("\n"),
        surrounding_context: lines.slice(contextStart, contextEnd).join("\n"),
      });
    }
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { project_id } = await req.json();
    if (!project_id) throw new Error("project_id required");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get unique event names from events table
    const { data: events, error: evErr } = await serviceClient
      .from("events")
      .select("event_name")
      .eq("project_id", project_id);
    if (evErr) throw evErr;

    const uniqueEvents = [...new Set((events || []).map((e: any) => e.event_name))];
    if (uniqueEvents.length === 0) {
      return new Response(JSON.stringify({ success: true, events_found: 0, total_locations: 0, unmatched: [], message: "No events to search for. Sync events from your analytics provider first." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clear old locations for this project
    await serviceClient.from("event_code_locations").delete().eq("project_id", project_id);

    let totalLocations = 0;
    const matched: string[] = [];
    const unmatched: string[] = [];

    // Search each event using RPC
    for (const eventName of uniqueEvents) {
      const { data: files, error: searchErr } = await serviceClient.rpc("search_event_in_files", {
        p_project_id: project_id,
        p_event_name: eventName,
      });
      if (searchErr) { console.error(`Search error for ${eventName}:`, searchErr); continue; }

      if (!files || files.length === 0) {
        unmatched.push(eventName);
        continue;
      }

      matched.push(eventName);

      for (const file of files) {
        const snippets = extractSnippets(file.content, eventName);
        for (const snippet of snippets) {
          await serviceClient.from("event_code_locations").insert({
            project_id,
            event_name: eventName,
            file_path: file.file_path,
            line_number: snippet.line_number,
            code_snippet: snippet.code_snippet,
            surrounding_context: snippet.surrounding_context,
          });
          totalLocations++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      events_searched: uniqueEvents.length,
      events_found: matched.length,
      total_locations: totalLocations,
      unmatched,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search-events-in-codebase error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
