import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Send, Brain, Trash2, Database, CheckCircle2, Target, Users, Rocket, BarChart3, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type Msg = { role: "user" | "assistant"; content: string; timestamp: Date };

interface StepBusinessContextProps {
  data: { product_description?: string; audience?: string; goals?: string };
  onUpdate: (data: { product_description?: string; audience?: string; goals?: string; [key: string]: string | undefined }) => void;
  onFinish: () => void;
  onClearContext?: () => void;
  isSubmitting: boolean;
  inline?: boolean;
  fullPage?: boolean;
  repoContext?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/business-context-chat`;
const ANALYTICS_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analytics-chat`;

export function StepBusinessContext({ data, onUpdate, onFinish, onClearContext, isSubmitting, inline, fullPage, repoContext }: StepBusinessContextProps) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hey! I'd love to learn about your product so we can tailor ECP for you. What does your product do?", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const [analyticsMode, setAnalyticsMode] = useState(false);
  const [aiConfidence, setAiConfidence] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text, timestamp: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const chatUrl = contextReady ? ANALYTICS_CHAT_URL : CHAT_URL;
      const bodyPayload: any = { messages: newMessages };
      if (!contextReady) {
        bodyPayload.repo_context = repoContext || undefined;
      } else {
        bodyPayload.business_context = data;
        if (repoContext) bodyPayload.repo_context = repoContext;
      }
      const resp = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error((err as any).error || "Failed to get response");
        setIsLoading(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && prev.length > newMessages.length) {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant" as const, content: assistantSoFar, timestamp: new Date() }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Parse confidence from response
      const confidenceMatch = assistantSoFar.match(/CONFIDENCE:(\d+)\s*$/);
      if (confidenceMatch) {
        const conf = Math.min(100, Math.max(0, parseInt(confidenceMatch[1], 10)));
        setAiConfidence(conf);
        // Strip the confidence tag from displayed message
        assistantSoFar = assistantSoFar.replace(/\nCONFIDENCE:\d+\s*$/, '').replace(/CONFIDENCE:\d+\s*$/, '');
        setMessages((prev) =>
          prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m))
        );
      }

      if (assistantSoFar.includes("CONTEXT_COMPLETE:")) {
        const jsonPart = assistantSoFar.split("CONTEXT_COMPLETE:")[1]?.replace(/CONFIDENCE:\d+\s*$/, '').trim();
        try {
          const parsed = JSON.parse(jsonPart || "{}");
          onUpdate(parsed);
          setContextReady(true);
          setAiConfidence(100);
          const cleanMsg = assistantSoFar.split("CONTEXT_COMPLETE:")[0].replace(/\nCONFIDENCE:\d+\s*$/, '').trim() ||
            "Great, I've got a good understanding of your business! You're all set.";
          const transitionMsg = cleanMsg + "\n\n✨ **You can now ask me analytics questions!** I'll use your business context to give tailored insights about your events, metrics, and tracking strategy.";
          setMessages((prev) =>
            prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: transitionMsg } : m))
          );
          // Auto-save context
          setTimeout(() => onFinish(), 500);
        } catch {
          // AI didn't return valid JSON, that's ok
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const understanding = contextReady ? 100 : aiConfidence;
  const contextBytes = new Blob([JSON.stringify(data)]).size;
  const hasContext = data.product_description || data.audience || data.goals;

  // Full page layout (ChatGPT-style)
  if (fullPage) {
    // No longer showing a separate summary screen - chat continues seamlessly

    return (
      <div className="flex flex-col h-full">
        {/* Top bar with understanding %, memory, and delete */}
        <div className="border-b border-border bg-background px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {contextReady ? (
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Brain className="h-4 w-4 text-primary shrink-0" />
            )}
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {contextReady ? "Analytics Assistant" : "Business Understanding"}
                </span>
                {!contextReady && <span className="text-xs font-mono text-primary">{understanding}%</span>}
                {contextReady && <span className="text-xs font-mono text-primary">Ready</span>}
              </div>
              {!contextReady && <Progress value={understanding} className="h-1.5" />}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <Database className="h-3 w-3" />
                {formatBytes(contextBytes)}
              </div>
              {(hasContext || messages.length > 1) && onClearContext && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={onClearContext}
                  title="Clear context"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert [&>p]:m-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1">{formatTime(msg.timestamp)}</span>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area at bottom */}
        <div className="border-t border-border bg-background px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2 items-center">
              <Input
                className="rounded-full px-4 h-11"
                placeholder={contextReady ? "Ask about analytics, events, metrics..." : "Tell us about your business..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                disabled={isLoading}
              />
              <Button size="icon" className="rounded-full h-11 w-11 shrink-0" onClick={send} disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compact / inline layout (for onboarding wizard or cards)
  return (
    <div className="space-y-4">
      {!inline && (
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Briefcase className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Business Context</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Chat with our AI to help us understand your business — it'll only take a minute.
          </p>
        </div>
      )}

      <div className={`${inline ? "" : "max-w-lg mx-auto"} border border-border rounded-lg overflow-hidden bg-card`}>
        <div className="h-80 overflow-y-auto p-4">
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert [&>p]:m-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1">{formatTime(msg.timestamp)}</span>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-border p-3 flex gap-2">
          <Input
            placeholder={contextReady ? "Ask about analytics..." : "Type your answer..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            disabled={isLoading}
          />
          <Button size="icon" onClick={send} disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!inline && (
        <div className="flex justify-center gap-3 pt-2">
          {contextReady ? (
            <Button onClick={onFinish} disabled={isSubmitting}>
              {isSubmitting ? "Finishing..." : "Finish Setup"}
            </Button>
          ) : (
            <Button variant="ghost" onClick={onFinish} disabled={isSubmitting}>
              Skip & Finish
            </Button>
          )}
        </div>
      )}
      {inline && contextReady && (
        <div className="pt-2">
          <Button size="sm" onClick={onFinish} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Context"}
          </Button>
        </div>
      )}
    </div>
  );
}
