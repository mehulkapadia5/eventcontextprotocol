import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, BarChart3, ArrowDown } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface FunnelStep {
  label: string;
  value: number;
  percent?: number;
}

export function FunnelWidget({ data }: { data: string }) {
  try {
    const parsed = JSON.parse(data);
    const steps: FunnelStep[] = parsed.steps || parsed;
    if (!Array.isArray(steps) || steps.length === 0) return null;

    const maxVal = steps[0]?.value || 1;
    const overallConversion = maxVal > 0 ? ((steps[steps.length - 1]?.value || 0) / maxVal * 100).toFixed(2) : "0";

    return (
      <Card className="my-3 overflow-hidden border-primary/20">
        <CardContent className="p-4">
          {parsed.title && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {parsed.title}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mb-3">
            Overall · <span className="font-mono font-medium">{overallConversion}%</span>
          </p>

          {/* Bar chart */}
          <div className="flex items-end gap-1.5 h-[140px] mb-2">
            {steps.map((step, i) => {
              const pct = maxVal > 0 ? (step.value / maxVal) * 100 : 0;
              const stepConversion = i > 0 && steps[i - 1].value > 0
                ? ((step.value / steps[i - 1].value) * 100).toFixed(1)
                : null;

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div className="text-center">
                    <span className="text-[10px] font-mono font-semibold text-foreground">
                      {i === 0 ? "100%" : `${pct.toFixed(1)}%`}
                    </span>
                    <p className="text-[9px] font-mono text-muted-foreground">
                      {step.value.toLocaleString()}
                    </p>
                  </div>
                  <div
                    className="w-full rounded-t-sm bg-primary/70 transition-all duration-500 min-h-[4px]"
                    style={{ height: `${Math.max(pct, 3)}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Step labels */}
          <div className="flex gap-1.5">
            {steps.map((step, i) => (
              <div key={i} className="flex-1 text-center">
                <p className="text-[10px] text-muted-foreground truncate">
                  <span className="font-semibold">{i + 1}</span>{" "}
                  <span className="font-medium">{step.label}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Step-to-step conversion rates */}
          {steps.length > 1 && (
            <div className="flex gap-1.5 mt-2 pt-2 border-t border-border/50">
              {steps.map((step, i) => {
                if (i === 0) return <div key={i} className="flex-1" />;
                const conv = steps[i - 1].value > 0
                  ? ((step.value / steps[i - 1].value) * 100).toFixed(1)
                  : "0";
                return (
                  <div key={i} className="flex-1 flex items-center justify-center gap-1 text-[10px]">
                    <ArrowDown className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="font-mono text-destructive">{conv}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  } catch {
    return null;
  }
}

interface MetricItem {
  label: string;
  value: string | number;
  change?: number;
  icon?: string;
}

export function MetricsWidget({ data }: { data: string }) {
  try {
    const parsed = JSON.parse(data);
    const metrics: MetricItem[] = parsed.metrics || parsed;
    if (!Array.isArray(metrics) || metrics.length === 0) return null;

    return (
      <div className="grid grid-cols-2 gap-2 my-3">
        {metrics.map((m, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{m.label}</p>
              <div className="flex items-end gap-2">
                <span className="text-lg font-bold font-mono">{m.value}</span>
                {m.change !== undefined && m.change !== 0 && (
                  <span
                    className={`flex items-center gap-0.5 text-xs font-mono ${
                      m.change > 0 ? "text-green-500" : "text-destructive"
                    }`}
                  >
                    {m.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {m.change > 0 ? "+" : ""}
                    {m.change}%
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  } catch {
    return null;
  }
}

interface TopEventItem {
  name: string;
  count: number;
  users?: number;
}

export function TopEventsWidget({ data }: { data: string }) {
  try {
    const parsed = JSON.parse(data);
    const events: TopEventItem[] = parsed.events || parsed;
    if (!Array.isArray(events) || events.length === 0) return null;

    const maxCount = Math.max(...events.map((e) => e.count));

    return (
      <Card className="my-3 overflow-hidden">
        <CardContent className="p-3 space-y-2">
          {parsed.title && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {parsed.title}
            </p>
          )}
          {events.map((ev, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono truncate">{ev.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{ev.count.toLocaleString()}</span>
                  {ev.users !== undefined && (
                    <span className="flex items-center gap-0.5 text-muted-foreground text-[10px]">
                      <Users className="h-2.5 w-2.5" />
                      {ev.users}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{ width: `${maxCount > 0 ? (ev.count / maxCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  } catch {
    return null;
  }
}

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(270, 60%, 55%)",
  "hsl(340, 65%, 55%)",
  "hsl(180, 50%, 45%)",
  "hsl(60, 70%, 45%)",
];

interface PieSlice {
  label: string;
  value: number;
}

export function PieChartWidget({ data }: { data: string }) {
  try {
    const parsed = JSON.parse(data);
    const slices: PieSlice[] = parsed.slices || parsed;
    if (!Array.isArray(slices) || slices.length === 0) return null;

    const total = slices.reduce((sum, s) => sum + s.value, 0);
    const chartData = slices.map((s) => ({
      name: s.label,
      value: s.value,
      percent: total > 0 ? ((s.value / total) * 100).toFixed(1) : "0",
    }));

    return (
      <Card className="my-3 overflow-hidden border-primary/20">
        <CardContent className="p-4">
          {parsed.title && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {parsed.title}
            </p>
          )}
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  dataKey="value"
                  paddingAngle={2}
                  stroke="none"
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-md">
                        <span className="font-medium">{d.name}</span>
                        <span className="ml-2 font-mono text-muted-foreground">
                          {d.value.toLocaleString()} ({d.percent}%)
                        </span>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 justify-center">
            {chartData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-mono">{d.percent}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  } catch {
    return null;
  }
}

interface TableData {
  title?: string;
  headers: string[];
  rows: (string | number)[][];
}

export function TableWidget({ data }: { data: string }) {
  try {
    const parsed: TableData = JSON.parse(data);
    const headers = parsed.headers;
    const rows = parsed.rows;
    if (!Array.isArray(headers) || !Array.isArray(rows) || headers.length === 0) return null;

    return (
      <Card className="my-3 overflow-hidden">
        <CardContent className="p-3">
          {parsed.title && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {parsed.title}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold text-muted-foreground bg-muted/50">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-border/50 last:border-0">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 font-mono">
                        {typeof cell === "number" ? cell.toLocaleString() : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  } catch {
    return null;
  }
}

/**
 * Parses a chat message and replaces special code blocks with widgets.
 * Supported: ```funnel, ```metrics, ```top-events, ```pie-chart, ```table
 */
export function renderMessageWithWidgets(content: string): { text: string; widgets: { type: string; data: string; position: number }[] } {
  const widgetRegex = /```(funnel|metrics|top-events|pie-chart|table)\n([\s\S]*?)```/g;
  const widgets: { type: string; data: string; position: number }[] = [];
  let cleanText = content;
  let match;
  let offset = 0;

  // Collect all widget blocks
  const allMatches: { full: string; type: string; data: string; index: number }[] = [];
  while ((match = widgetRegex.exec(content)) !== null) {
    allMatches.push({ full: match[0], type: match[1], data: match[2].trim(), index: match.index });
  }

  // Replace from end to start to preserve indices
  for (let i = allMatches.length - 1; i >= 0; i--) {
    const m = allMatches[i];
    const placeholder = `\n%%WIDGET_${i}%%\n`;
    cleanText = cleanText.slice(0, m.index) + placeholder + cleanText.slice(m.index + m.full.length);
    widgets.unshift({ type: m.type, data: m.data, position: i });
  }

  return { text: cleanText, widgets };
}
