import ReactMarkdown from "react-markdown";
import { FunnelWidget, MetricsWidget, TopEventsWidget, renderMessageWithWidgets } from "./ChatWidgets";

interface ChatMessageContentProps {
  content: string;
}

const proseClasses = [
  "prose prose-sm dark:prose-invert max-w-none font-['Mona_Sans',sans-serif]",
  // Headings
  "[&>h1]:text-lg [&>h1]:font-bold [&>h1]:mt-4 [&>h1]:mb-2",
  "[&>h2]:text-base [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1.5",
  "[&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mt-2 [&>h3]:mb-1",
  // Paragraphs & lists — tighter bullet styling
  "[&>p]:my-1.5 [&>p]:leading-relaxed",
  "[&>ul]:my-1.5 [&>ul]:pl-4 [&>ul]:list-disc [&>ol]:my-1.5 [&>ol]:pl-4 [&>ol]:list-decimal",
  "[&_li]:my-0.5 [&_li]:leading-snug",
  "[&_ul]:list-disc [&_ol]:list-decimal",
  // Nested lists
  "[&_ul_ul]:mt-0.5 [&_ul_ul]:mb-0 [&_ol_ol]:mt-0.5 [&_ol_ol]:mb-0",
  // Horizontal rules
  "[&>hr]:my-3 [&>hr]:border-border",
  // Bold & emphasis
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  // Code blocks
  "[&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:my-2 [&_pre]:text-xs [&_pre]:overflow-x-auto",
  "[&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  // Tables
  "[&_table]:w-full [&_table]:my-2 [&_table]:text-xs",
  "[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted [&_th]:font-semibold [&_th]:text-left",
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
  // Blockquotes
  "[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground",
].join(" ");

function MarkdownBlock({ content }: { content: string }) {
  return (
    <div className={proseClasses}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

export function ChatMessageContent({ content }: ChatMessageContentProps) {
  // Strip internal protocol tags (SQL queries, etc.) that shouldn't be shown to users
  const cleanedContent = content
    .replace(/<SQL>[\s\S]*?<\/SQL>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const { text, widgets } = renderMessageWithWidgets(cleanedContent);

  if (widgets.length === 0) {
    return <MarkdownBlock content={cleanedContent} />;
  }

  const parts = text.split(/%%WIDGET_(\d+)%%/);

  return (
    <div className="space-y-0">
      {parts.map((part, i) => {
        if (i % 2 === 0) {
          const trimmed = part.trim();
          if (!trimmed) return null;
          return <MarkdownBlock key={i} content={trimmed} />;
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
