import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const callerClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    // Check admin role
    const { data: isAdmin } = await callerClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_email } = await req.json();
    if (!user_email) throw new Error("user_email is required");

    // Use service role to generate a magic link
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: user_email,
    });

    if (linkError) {
      console.error("Generate link error:", linkError);
      throw new Error(linkError.message);
    }

    // The generated link contains the token — we need to construct a usable URL
    const token_hash = linkData.properties?.hashed_token;
    if (!token_hash) throw new Error("Failed to generate token");

    // Build the verify URL — this confirms the magic link and redirects the user
    const redirectTo = "https://eventcontextprotocol.lovable.app/dashboard";
    const loginUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=magiclink&redirect_to=${encodeURIComponent(redirectTo)}`;

    return new Response(JSON.stringify({ url: loginUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-impersonate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
