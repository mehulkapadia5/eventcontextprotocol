import ReactMarkdown from "react-markdown";
import { FunnelWidget, MetricsWidget, TopEventsWidget, renderMessageWithWidgets } from "./ChatWidgets";

interface ChatMessageContentProps {
  content: string;
}

export function ChatMessageContent({ content }: ChatMessageContentProps) {
  const { text, widgets } = renderMessageWithWidgets(content);

  if (widgets.length === 0) {
    return (
      <div className="prose prose-sm dark:prose-invert [&>p]:m-0">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  // Split text by widget placeholders and interleave
  const parts = text.split(/%%WIDGET_(\d+)%%/);

  return (
    <div className="space-y-0">
      {parts.map((part, i) => {
        // Even indices are text, odd indices are widget indices
        if (i % 2 === 0) {
          const trimmed = part.trim();
          if (!trimmed) return null;
          return (
            <div key={i} className="prose prose-sm dark:prose-invert [&>p]:m-0">
              <ReactMarkdown>{trimmed}</ReactMarkdown>
            </div>
          );
        }

        const widgetIndex = parseInt(part, 10);
        const widget = widgets.find((w) => w.position === widgetIndex);
        if (!widget) return null;

        switch (widget.type) {
          case "funnel":
            return <FunnelWidget key={i} data={widget.data} />;
          case "metrics":
            return <MetricsWidget key={i} data={widget.data} />;
          case "top-events":
            return <TopEventsWidget key={i} data={widget.data} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
