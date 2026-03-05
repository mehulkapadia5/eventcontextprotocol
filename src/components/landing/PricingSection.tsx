import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, Zap, Rocket, Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function useIsIndianUser(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz === "Asia/Kolkata" || tz === "Asia/Calcutta";
  } catch {
    return false;
  }
}

const PLANS = [
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
    cta: "Get Started",
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
    features: [
      "Everything in Free, plus:",
      "100 monthly queries",
      "Advanced analytics",
      "Email support",
      "Custom context",
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
    features: [
      "All features in Starter, plus:",
      "350 monthly queries",
      "Priority support",
      "Team access",
      "Custom integrations",
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
    features: [
      "Everything in Pro, plus:",
      "1,000 monthly queries",
      "Dedicated support",
      "Onboarding services",
      "SLA guarantee",
    ],
  },
];

const ADDONS = [
  { queries: 50, priceUSD: "$12", priceINR: "₹1,099", description: "Occasional overages" },
  { queries: 150, priceUSD: "$30", priceINR: "₹2,749", description: "Regular top-ups" },
  { queries: 500, priceUSD: "$80", priceINR: "₹7,299", description: "Heavy months" },
];

export function PricingSection() {
  const navigate = useNavigate();
  const isIndianDefault = useIsIndianUser();
  const [showINR, setShowINR] = useState<boolean>(isIndianDefault);

  return (
    <section id="pricing" style={{ padding: "80px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: "2.5rem", fontWeight: 700, color: "#0a0a0f", marginBottom: 12 }}>
          Pricing
        </h2>
        <p style={{ color: "#555", fontSize: "1.05rem", maxWidth: 560, margin: "0 auto 20px" }}>
          Start for free. Upgrade to get the capacity that matches your needs.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          <Button
            size="sm"
            variant={showINR ? "default" : "outline"}
            className="text-xs px-3 h-7"
            onClick={() => setShowINR(true)}
          >
            INR ₹
          </Button>
          <Button
            size="sm"
            variant={!showINR ? "default" : "outline"}
            className="text-xs px-3 h-7"
            onClick={() => setShowINR(false)}
          >
            USD $
          </Button>
        </div>
      </div>

      {/* Plans Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 0,
          borderTop: "1px solid #ddd",
          borderBottom: "1px solid #ddd",
          marginTop: 32,
        }}
      >
        {PLANS.map((plan, index) => (
          <div
            key={plan.id}
            style={{
              padding: "32px 24px",
              borderRight: index < PLANS.length - 1 ? "1px solid #ddd" : "none",
              background: plan.popular ? "rgba(99,102,241,0.04)" : "transparent",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Name */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 600, color: "#0a0a0f" }}>{plan.name}</h3>
              {plan.popular && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Popular
                </Badge>
              )}
            </div>

            {/* Description */}
            <p style={{ fontSize: "0.82rem", color: "#777", lineHeight: 1.5, minHeight: 42, marginBottom: 16 }}>
              {plan.description}
            </p>

            {/* Price */}
            <div style={{ height: 72 }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: "2.2rem", fontWeight: 700, color: "#0a0a0f" }}>
                  {showINR ? plan.priceINR : plan.priceUSD}
                </span>
                {plan.period && (
                  <span style={{ fontSize: "0.85rem", color: "#888", marginLeft: 6 }}>{plan.period}</span>
                )}
              </div>
              <p style={{ fontSize: "0.75rem", color: "#999" }}>
                {plan.subtitle || "\u00A0"}
              </p>
            </div>

            {/* CTA */}
            <Button
              className="w-full mb-5"
              variant={plan.popular ? "default" : "outline"}
              onClick={() => navigate("/auth")}
            >
              {plan.cta}
            </Button>

            {/* Features */}
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {plan.features.map((f, i) => (
                <li
                  key={f}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: "0.8rem",
                    marginBottom: 10,
                    color: i === 0 ? "#888" : "#333",
                    fontWeight: i === 0 ? 500 : 400,
                  }}
                >
                  {i > 0 && <Check style={{ width: 14, height: 14, color: "#6366f1", flexShrink: 0, marginTop: 2 }} />}
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

    </section>
  );
}
