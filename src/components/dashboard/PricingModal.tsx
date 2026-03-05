import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles, Zap, Rocket, Building2, Plus, Crown } from "lucide-react";
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

function useIsIndianUser(): boolean {
  const [isIndian, setIsIndian] = useState(false);
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setIsIndian(tz === "Asia/Kolkata" || tz === "Asia/Calcutta");
    } catch {
      setIsIndian(false);
    }
  }, []);
  return isIndian;
}

interface PlanDef {
  id: string;
  name: string;
  description: string;
  priceUSD: string;
  priceINR: string;
  period: string;
  subtitle: string;
  icon: typeof Sparkles;
  popular: boolean;
  cta: string;
  disabled: boolean;
  features: string[];
}

const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    description: "Explore Magnitude and see what it can do for you.",
    priceUSD: "$0",
    priceINR: "₹0",
    period: "",
    subtitle: "Free forever",
    icon: Sparkles,
    popular: false,
    cta: "Current Plan",
    disabled: true,
    features: [
      "5 daily credits (up to 30/month)",
      "Basic analytics queries",
      "Community support",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    description: "For individuals getting started with product analytics.",
    priceUSD: "$20",
    priceINR: "₹1,899",
    period: "per month",
    subtitle: "",
    icon: Zap,
    popular: false,
    cta: "Get Started",
    disabled: false,
    features: [
      "Everything in Free, plus:",
      "100 monthly queries",
      "Advanced analytics",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For teams that need deeper insights and more capacity.",
    priceUSD: "$50",
    priceINR: "₹4,599",
    period: "per month",
    subtitle: "",
    icon: Rocket,
    popular: true,
    cta: "Get Started",
    disabled: false,
    features: [
      "All features in Starter, plus:",
      "350 monthly queries",
      "Priority support",
      "Team access",
    ],
  },
  {
    id: "business",
    name: "Business",
    description: "Built for orgs needing flexibility, scale, and governance.",
    priceUSD: "$100",
    priceINR: "₹8,999",
    period: "per month",
    subtitle: "Flexible billing",
    icon: Building2,
    popular: false,
    cta: "Contact Us",
    disabled: false,
    features: [
      "Everything in Pro, plus:",
      "1,000 monthly queries",
      "Dedicated support",
      "Onboarding services",
    ],
  },
  {
    id: "unlimited",
    name: "Unlimited",
    description: "For power users and teams who never want to worry about limits.",
    priceUSD: "$399",
    priceINR: "₹35,999",
    period: "per month",
    subtitle: "No query limits",
    icon: Crown,
    popular: false,
    cta: "Get Started",
    disabled: false,
    features: [
      "Everything in Business, plus:",
      "Unlimited queries",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
];

interface AddonDef {
  id: string;
  queries: number;
  priceUSD: string;
  priceINR: string;
  description: string;
}

const ADDONS: AddonDef[] = [
  { id: "addon_50", queries: 50, priceUSD: "$12", priceINR: "₹1,099", description: "Occasional overages" },
  { id: "addon_150", queries: 150, priceUSD: "$30", priceINR: "₹2,749", description: "Regular top-ups" },
  { id: "addon_500", queries: 500, priceUSD: "$80", priceINR: "₹7,299", description: "Heavy months" },
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
  const isIndianDefault = useIsIndianUser();
  const [showINR, setShowINR] = useState<boolean | null>(null);
  const isINR = showINR ?? isIndianDefault;
  const currency = isINR ? "INR" : "USD";

  const handlePurchase = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Failed to load payment gateway. Please try again.");
        return;
      }

      const { data: orderData, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { plan_id: planId, currency },
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

            toast.success(`${verifyData.credits_added} credits added! New balance: ${verifyData.new_balance}`);
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

      onOpenChange(false);
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
      <DialogContent className="max-w-6xl p-0">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-semibold">Pricing</DialogTitle>
            <p className="text-center text-muted-foreground text-sm">
              Start for free. Upgrade to get the capacity that matches your needs.
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Button
                size="sm"
                variant={isINR ? "default" : "outline"}
                className="text-xs px-3 h-7"
                onClick={() => setShowINR(true)}
              >
                INR ₹
              </Button>
              <Button
                size="sm"
                variant={!isINR ? "default" : "outline"}
                className="text-xs px-3 h-7"
                onClick={() => setShowINR(false)}
              >
                USD $
              </Button>
            </div>
          </DialogHeader>
        </div>

        {/* Subscription Tiers */}
        <div className="overflow-x-auto mx-6 mt-4">
          <div className="grid grid-cols-5 gap-0 border-t border-border min-w-[800px]">
          {PLANS.map((plan, index) => (
            <div
              key={plan.id}
              className={`flex flex-col p-4 ${
                index < PLANS.length - 1 ? "border-r border-border" : ""
              } ${plan.popular ? "bg-accent/30" : ""}`}
            >
              {/* Header */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold">{plan.name}</h3>
                  {plan.popular && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      Popular
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed min-h-[2.5rem]">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="h-[4.5rem] mb-1">
                <div>
                  <span className="text-2xl font-bold">
                    {isINR ? plan.priceINR : plan.priceUSD}
                  </span>
                </div>
                {plan.period && (
                  <p className="text-xs text-muted-foreground">{plan.period}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {plan.subtitle || "\u00A0"}
                </p>
              </div>

              {/* CTA */}
              <Button
                className="w-full mb-4"
                size="sm"
                variant={plan.popular ? "default" : plan.disabled ? "secondary" : "outline"}
                disabled={plan.disabled || !!loadingPlan}
                onClick={() => handlePurchase(plan.id)}
              >
                {loadingPlan === plan.id && (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                )}
                {plan.cta}
              </Button>

              {/* Features */}
              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f, i) => (
                  <li key={f} className="flex items-start gap-2 text-xs">
                    {i === 0 ? (
                      <span className="text-muted-foreground font-medium">{f}</span>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
          </div>
            ))}
          </div>
        </div>

        <Separator className="mx-6" />

        {/* Add-on Credits */}
        <div className="px-6 pb-6 pt-2">
          <div className="mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-primary" />
              Running low? Buy extra queries
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              No subscription needed. Credits never expire — use them anytime.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ADDONS.map((addon) => (
              <div
                key={addon.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="font-medium text-sm">{addon.queries} queries</p>
                  <p className="text-xs text-muted-foreground">{addon.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!loadingPlan}
                  onClick={() => handlePurchase(addon.id)}
                >
                  {loadingPlan === addon.id && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  )}
                  {isINR ? addon.priceINR : addon.priceUSD}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
