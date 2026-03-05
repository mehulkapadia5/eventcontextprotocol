import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, Sparkles, Zap, Rocket, TrendingUp, Building2, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userEmail?: string;
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    queries: "20/mo",
    price: "$0",
    icon: Sparkles,
    popular: false,
    features: ["20 queries per month", "Basic analytics", "Community support"],
    cta: "Current Plan",
    disabled: true,
  },
  {
    id: "starter",
    name: "Starter",
    queries: "100/mo",
    price: "$20",
    icon: Zap,
    popular: false,
    features: ["100 queries per month", "Advanced analytics", "Email support"],
    cta: "Get Starter",
    disabled: false,
  },
  {
    id: "pro",
    name: "Pro",
    queries: "350/mo",
    price: "$50",
    icon: Rocket,
    popular: true,
    features: ["350 queries per month", "Full analytics suite", "Priority support", "Custom context"],
    cta: "Get Pro",
    disabled: false,
  },
  {
    id: "business",
    name: "Business",
    queries: "1,000/mo",
    price: "$100",
    icon: Building2,
    popular: false,
    features: ["1,000 queries per month", "Dedicated support", "Custom integrations", "Team access"],
    cta: "Get Business",
    disabled: false,
  },
  {
    id: "scale",
    name: "Scale",
    queries: "3,000/mo",
    price: "$250",
    icon: TrendingUp,
    popular: false,
    features: ["3,000 queries per month", "White-glove onboarding", "SLA guarantee", "Unlimited team members"],
    cta: "Get Scale",
    disabled: false,
  },
];

const ADDONS = [
  { id: "addon_50", queries: 50, price: "$12", description: "Occasional overages" },
  { id: "addon_150", queries: 150, price: "$30", description: "Regular top-ups" },
  { id: "addon_500", queries: 500, price: "$80", description: "Heavy months" },
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PricingModal({ open, onOpenChange, onSuccess, userEmail }: PricingModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handlePurchase = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Failed to load payment gateway. Please try again.");
        return;
      }

      const { data: orderData, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { plan_id: planId },
      });

      if (error || orderData?.error) {
        throw new Error(orderData?.error || error?.message || "Failed to create order");
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Magnitude",
        description: `${orderData.plan_name} — ${orderData.credits} credits`,
        order_id: orderData.order_id,
        prefill: { email: userEmail },
        theme: { color: "#6366f1" },
        handler: async (response: any) => {
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
              "razorpay-verify-payment",
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
              }
            );

            if (verifyError || verifyData?.error) {
              throw new Error(verifyData?.error || "Verification failed");
            }

            toast.success(`🎉 ${verifyData.credits_added} credits added! New balance: ${verifyData.new_balance}`);
            onSuccess();
            onOpenChange(false);
          } catch (e: any) {
            toast.error(e.message || "Payment verification failed");
          }
        },
        modal: {
          ondismiss: () => {
            setLoadingPlan(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Choose Your Plan</DialogTitle>
          <p className="text-center text-muted-foreground text-sm">
            Pick the plan that fits your team. Upgrade or top up anytime.
          </p>
        </DialogHeader>

        {/* Subscription Tiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 py-4">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${plan.popular ? "border-primary shadow-md ring-1 ring-primary/20" : ""}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap">
                  ⭐ Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2 px-3 pt-5">
                <plan.icon className="h-6 w-6 mx-auto text-primary mb-1.5" />
                <CardTitle className="text-base">{plan.name}</CardTitle>
                <div className="mt-1">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  {plan.id !== "free" && <span className="text-xs text-muted-foreground">/mo</span>}
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  {plan.queries} queries
                </p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col px-3 pb-4">
                <ul className="space-y-1.5 flex-1 mb-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  size="sm"
                  variant={plan.popular ? "default" : plan.disabled ? "secondary" : "outline"}
                  disabled={plan.disabled || !!loadingPlan}
                  onClick={() => handlePurchase(plan.id)}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  {plan.cta}
                </Button>
                {!plan.disabled && plan.id !== "free" && (
                  <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                    Need more? <span className="text-primary font-medium">Top up anytime →</span>
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        {/* Add-on Credits */}
        <div className="py-3">
          <div className="text-center mb-3">
            <h3 className="text-base font-semibold flex items-center justify-center gap-1.5">
              <Plus className="h-4 w-4 text-primary" />
              Running low? Buy extra queries
            </h3>
            <p className="text-xs text-muted-foreground">
              No subscription needed. Credits never expire — use them anytime.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ADDONS.map((addon) => (
              <Card key={addon.id} className="flex flex-col">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold text-sm">{addon.queries} queries</p>
                    <p className="text-xs text-muted-foreground">{addon.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!loadingPlan}
                    onClick={() => handlePurchase(addon.id)}
                  >
                    {loadingPlan === addon.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    {addon.price}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
