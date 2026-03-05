import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Plans with both USD (cents) and INR (paise) pricing
const PLANS: Record<string, { name: string; credits: number; usd_cents: number; inr_paise: number }> = {
  starter:   { name: "Starter",   credits: 100,  usd_cents: 2000,   inr_paise: 189900 },
  pro:       { name: "Pro",       credits: 350,  usd_cents: 5000,   inr_paise: 459900 },
  business:  { name: "Business",  credits: 1000, usd_cents: 10000,  inr_paise: 899900 },
  addon_50:  { name: "50 Queries",  credits: 50,  usd_cents: 1200,  inr_paise: 109900 },
  addon_150: { name: "150 Queries", credits: 150, usd_cents: 3000,  inr_paise: 274900 },
  addon_500: { name: "500 Queries", credits: 500, usd_cents: 8000,  inr_paise: 729900 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Invalid auth token");

    const { plan_id, currency } = await req.json();
    const plan = PLANS[plan_id];
    if (!plan) throw new Error(`Invalid plan: ${plan_id}`);

    const isINR = currency === "INR";
    const amount = isINR ? plan.inr_paise : plan.usd_cents;
    const cur = isINR ? "INR" : "USD";

    // Create Razorpay order
    const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const rzpResp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: cur,
        receipt: `order_${user.id}_${Date.now()}`,
        notes: {
          user_id: user.id,
          plan_id,
          credits: plan.credits.toString(),
        },
      }),
    });

    if (!rzpResp.ok) {
      const errBody = await rzpResp.text();
      throw new Error(`Razorpay order creation failed [${rzpResp.status}]: ${errBody}`);
    }

    const rzpOrder = await rzpResp.json();

    // Store order in DB (always store in paise for INR, cents for USD)
    await supabase.from("payment_orders").insert({
      user_id: user.id,
      razorpay_order_id: rzpOrder.id,
      plan_id,
      amount_paise: amount,
      credits: plan.credits,
      status: "created",
    });

    return new Response(
      JSON.stringify({
        order_id: rzpOrder.id,
        amount,
        currency: cur,
        key_id: RAZORPAY_KEY_ID,
        plan_name: plan.name,
        credits: plan.credits,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error creating order:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
