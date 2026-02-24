import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Briefcase, Send, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

interface StepBusinessContextProps {
  data: { product_description?: string; audience?: string; goals?: string };
  onUpdate: (data: { product_description?: string; audience?: string; goals?: string; [key: string]: string | undefined }) => void;
  onFinish: () => void;
  isSubmitting: boolean;
  inline?: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/business-context-chat`;

export function StepBusinessContext({ data, onUpdate, onFinish, isSubmitting, inline }: StepBusinessContextProps) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hey! I'd love to learn about your product so we can tailor ECP for you. What does your product do?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
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
          return [...prev, { role: "assistant", content: assistantSoFar }];
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

      // Check if context is complete
      if (assistantSoFar.includes("CONTEXT_COMPLETE:")) {
        const jsonPart = assistantSoFar.split("CONTEXT_COMPLETE:")[1]?.trim();
        try {
          const parsed = JSON.parse(jsonPart || "{}");
          onUpdate(parsed);
          setContextReady(true);
          // Clean the message to remove the JSON
          const cleanMsg = assistantSoFar.split("CONTEXT_COMPLETE:")[0].trim() ||
            "Great, I've got a good understanding of your business! You're all set.";
          setMessages((prev) =>
            prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleanMsg } : m))
          );
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
        <ScrollArea className="h-80 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
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
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {!contextReady && (
          <div className="border-t border-border p-3 flex gap-2">
            <Input
              placeholder="Type your answer..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              disabled={isLoading}
            />
            <Button size="icon" onClick={send} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
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
