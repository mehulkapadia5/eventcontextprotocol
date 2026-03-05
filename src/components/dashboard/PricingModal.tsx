import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, Sparkles, Zap, Rocket } from "lucide-react";
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
    id: "starter",
    name: "Starter",
    credits: 50,
    price: "₹499",
    pricePerCredit: "₹9.98",
    icon: Sparkles,
    popular: false,
    features: ["50 chat messages", "Basic analytics queries", "Email support"],
  },
  {
    id: "pro",
    name: "Pro",
    credits: 200,
    price: "₹1,499",
    pricePerCredit: "₹7.50",
    icon: Zap,
    popular: true,
    features: ["200 chat messages", "Advanced analytics", "Priority support", "Custom context"],
  },
  {
    id: "business",
    name: "Business",
    credits: 500,
    price: "₹2,999",
    pricePerCredit: "₹6.00",
    icon: Rocket,
    popular: false,
    features: ["500 chat messages", "Full analytics suite", "Dedicated support", "Custom integrations", "Team access"],
  },
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Get More Credits</DialogTitle>
          <p className="text-center text-muted-foreground text-sm">
            Choose a plan that fits your needs
          </p>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${plan.popular ? "border-primary shadow-md" : ""}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <plan.icon className="h-8 w-8 mx-auto text-primary mb-2" />
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {plan.credits} credits · {plan.pricePerCredit}/credit
                </p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-2 flex-1 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  disabled={!!loadingPlan}
                  onClick={() => handlePurchase(plan.id)}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Buy {plan.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
