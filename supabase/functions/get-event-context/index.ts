import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { project_id, event_name, file_path } = await req.json();
    if (!project_id) throw new Error("project_id required");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) throw new Error("Unauthorized");

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (event_name) {
      const { data: locations } = await serviceClient
        .from("event_code_locations")
        .select("*")
        .eq("project_id", project_id)
        .eq("event_name", event_name);

      const { data: annotation } = await serviceClient
        .from("event_annotations")
        .select("*")
        .eq("project_id", project_id)
        .eq("event_name", event_name)
        .maybeSingle();

      return new Response(JSON.stringify({ event_name, annotation, code_locations: locations || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file_path) {
      const { data: locations } = await serviceClient
        .from("event_code_locations")
        .select("*")
        .eq("project_id", project_id)
        .eq("file_path", file_path);

      return new Response(JSON.stringify({ file_path, events: locations || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Summary: all events with locations count
    const { data: locations } = await serviceClient
      .from("event_code_locations")
      .select("event_name, file_path, line_number, semantic_meaning")
      .eq("project_id", project_id);

    const { data: annotations } = await serviceClient
      .from("event_annotations")
      .select("event_name, description, category, status")
      .eq("project_id", project_id);

    const summary = new Map<string, any>();
    for (const loc of locations || []) {
      if (!summary.has(loc.event_name)) {
        const ann = (annotations || []).find((a: any) => a.event_name === loc.event_name);
        summary.set(loc.event_name, { event_name: loc.event_name, annotation: ann || null, locations: [] });
      }
      summary.get(loc.event_name).locations.push({ file_path: loc.file_path, line_number: loc.line_number, semantic_meaning: loc.semantic_meaning });
    }

    return new Response(JSON.stringify({ events: [...summary.values()] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-event-context error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
