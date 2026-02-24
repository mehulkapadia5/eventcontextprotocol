import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Users, Rocket, Code, BarChart3, FileText, LayoutGrid } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ContextMemoryViewProps {
  data: Record<string, string | undefined>;
  analytics?: { posthog_key?: string; mixpanel_key?: string; posthog_personal_key?: string; mixpanel_secret?: string };
  codebase?: { github_url?: string };
}

function generateMarkdown(data: Record<string, string | undefined>, analytics?: any, codebase?: any): string {
  const lines: string[] = ["# Business Context Memory", ""];

  if (data.product_description) {
    lines.push("## Product Description", "", data.product_description, "");
  }
  if (data.audience) {
    lines.push("## Target Audience", "", data.audience, "");
  }
  if (data.goals) {
    lines.push("## Business Goals", "", data.goals, "");
  }

  // Additional dynamic keys
  const knownKeys = new Set(["product_description", "audience", "goals"]);
  const extras = Object.entries(data).filter(([k, v]) => !knownKeys.has(k) && v);
  if (extras.length > 0) {
    lines.push("## Additional Insights", "");
    extras.forEach(([key, value]) => {
      const title = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      lines.push(`### ${title}`, "", value || "", "");
    });
  }

  if (codebase?.github_url) {
    lines.push("## Connected Repository", "", `- Repository: ${codebase.github_url}`, "");
  }

  if (analytics) {
    const connections: string[] = [];
    if (analytics.posthog_key || analytics.posthog_personal_key) connections.push("PostHog");
    if (analytics.mixpanel_key || analytics.mixpanel_secret) connections.push("Mixpanel");
    if (connections.length) {
      lines.push("## Analytics Connections", "", ...connections.map((c) => `- ${c}`), "");
    }
  }

  return lines.join("\n");
}

const contextCards = [
  { key: "product_description", label: "Product", icon: Target, color: "text-primary" },
  { key: "audience", label: "Audience", icon: Users, color: "text-primary" },
  { key: "goals", label: "Goals", icon: Rocket, color: "text-primary" },
];

export function ContextMemoryView({ data, analytics, codebase }: ContextMemoryViewProps) {
  const [view, setView] = useState<"cards" | "markdown">("cards");
  const markdown = generateMarkdown(data, analytics, codebase);

  const knownKeys = new Set(["product_description", "audience", "goals"]);
  const extras = Object.entries(data).filter(([k, v]) => !knownKeys.has(k) && v);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant={view === "cards" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("cards")}
          className="gap-1"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Cards
        </Button>
        <Button
          variant={view === "markdown" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("markdown")}
          className="gap-1"
        >
          <FileText className="h-3.5 w-3.5" />
          Markdown
        </Button>
      </div>

      {view === "cards" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {contextCards.map(({ key, label, icon: Icon }) => (
              <Card key={key} className={!data[key] ? "opacity-50" : ""}>
                <CardHeader className="pb-2 flex flex-row items-center gap-2">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <CardTitle className="text-sm">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-4">
                    {data[key] || "Not set"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {extras.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Additional Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {extras.map(([key, value]) => (
                  <div key={key}>
                    <span className="text-xs font-medium text-muted-foreground">
                      {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                    <p className="text-sm">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 flex-wrap">
            {codebase?.github_url && (
              <Badge variant="outline" className="gap-1">
                <Code className="h-3 w-3" /> {codebase.github_url.split("/").slice(-1)[0]}
              </Badge>
            )}
            {(analytics?.posthog_key || analytics?.posthog_personal_key) && (
              <Badge variant="outline" className="gap-1">
                <BarChart3 className="h-3 w-3" /> PostHog
              </Badge>
            )}
            {(analytics?.mixpanel_key || analytics?.mixpanel_secret) && (
              <Badge variant="outline" className="gap-1">
                <BarChart3 className="h-3 w-3" /> Mixpanel
              </Badge>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => navigator.clipboard.writeText(markdown)}
            >
              Copy Markdown
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
