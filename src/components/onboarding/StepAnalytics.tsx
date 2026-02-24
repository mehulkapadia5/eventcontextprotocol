import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, Check } from "lucide-react";

interface StepAnalyticsProps {
  data: { posthog_key?: string; mixpanel_key?: string; ga_property_id?: string };
  onUpdate: (data: { posthog_key?: string; mixpanel_key?: string; ga_property_id?: string }) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function StepAnalytics({ data, onUpdate, onNext, onSkip }: StepAnalyticsProps) {
  const [connecting, setConnecting] = useState<"posthog" | "mixpanel" | "ga" | null>(null);

  const handleConnect = (provider: "posthog" | "mixpanel" | "ga") => {
    setConnecting(connecting === provider ? null : provider);
  };

  const isConnected = (provider: "posthog" | "mixpanel" | "ga") => {
    if (provider === "posthog") return !!data.posthog_key;
    if (provider === "mixpanel") return !!data.mixpanel_key;
    return !!data.ga_property_id;
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Connect Analytics</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Import your existing event data from PostHog, Mixpanel, or Google Analytics.
        </p>
      </div>

      <div className="grid gap-4 max-w-lg mx-auto">
        {/* PostHog */}
        <Card className={isConnected("posthog") ? "border-primary" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">PostHog</CardTitle>
                <CardDescription>Product analytics platform</CardDescription>
              </div>
              {isConnected("posthog") ? (
                <div className="flex items-center gap-1 text-sm text-primary">
                  <Check className="h-4 w-4" /> Connected
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => handleConnect("posthog")}>
                  {connecting === "posthog" ? "Cancel" : "Connect"}
                </Button>
              )}
            </div>
          </CardHeader>
          {connecting === "posthog" && (
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter PostHog API key"
                  value={data.posthog_key || ""}
                  onChange={(e) => onUpdate({ ...data, posthog_key: e.target.value })}
                />
                <Button size="sm" disabled={!data.posthog_key} onClick={() => setConnecting(null)}>
                  Save
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Mixpanel */}
        <Card className={isConnected("mixpanel") ? "border-primary" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Mixpanel</CardTitle>
                <CardDescription>Event tracking & analytics</CardDescription>
              </div>
              {isConnected("mixpanel") ? (
                <div className="flex items-center gap-1 text-sm text-primary">
                  <Check className="h-4 w-4" /> Connected
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => handleConnect("mixpanel")}>
                  {connecting === "mixpanel" ? "Cancel" : "Connect"}
                </Button>
              )}
            </div>
          </CardHeader>
          {connecting === "mixpanel" && (
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Mixpanel project token"
                  value={data.mixpanel_key || ""}
                  onChange={(e) => onUpdate({ ...data, mixpanel_key: e.target.value })}
                />
                <Button size="sm" disabled={!data.mixpanel_key} onClick={() => setConnecting(null)}>
                  Save
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Google Analytics */}
        <Card className={isConnected("ga") ? "border-primary" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Google Analytics 4</CardTitle>
                <CardDescription>Web analytics by Google</CardDescription>
              </div>
              {isConnected("ga") ? (
                <div className="flex items-center gap-1 text-sm text-primary">
                  <Check className="h-4 w-4" /> Connected
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => handleConnect("ga")}>
                  {connecting === "ga" ? "Cancel" : "Connect"}
                </Button>
              )}
            </div>
          </CardHeader>
          {connecting === "ga" && (
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter GA4 Property ID"
                  value={data.ga_property_id || ""}
                  onChange={(e) => onUpdate({ ...data, ga_property_id: e.target.value })}
                />
                <Button size="sm" disabled={!data.ga_property_id} onClick={() => setConnecting(null)}>
                  Save
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      <div className="flex justify-center gap-3 pt-4">
        <Button variant="ghost" onClick={onSkip}>Skip for now</Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}
