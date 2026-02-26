import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Send, Brain, Trash2, Database, CheckCircle2, Target, Users, Rocket, BarChart3, Sparkles, Cpu } from "lucide-react";
import { PromptSuggestion } from "@/components/ui/prompt-suggestion";
import ReactMarkdown from "react-markdown";
import { ChatMessageContent } from "@/components/chat/ChatMessageContent";
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
  onFinish: (businessOverride?: { product_description?: string; audience?: string; goals?: string; [key: string]: string | undefined }) => void;
  onClearContext?: () => void;
  isSubmitting: boolean;
  inline?: boolean;
  fullPage?: boolean;
  repoContext?: string | null;
  savedConfidence?: number;
  onConfidenceChange?: (confidence: number) => void;
  initialMessages?: Msg[];
  onMessagesChange?: (messages: { role: "user" | "assistant"; content: string }[]) => void;
  onNewChat?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/business-context-chat`;
const ANALYTICS_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analytics-chat`;

export function StepBusinessContext({ data, onUpdate, onFinish, onClearContext, isSubmitting, inline, fullPage, repoContext, savedConfidence, onConfidenceChange, initialMessages: initialMessagesProp, onMessagesChange, onNewChat }: StepBusinessContextProps) {
  const hasExistingData = !!(data.product_description || data.audience || data.goals);
  const initialMessage = hasExistingData
    ? "Welcome back! I remember your business context. ✨ You can ask me analytics questions or update your context anytime."
    : repoContext
      ? "Analyzing your codebase... one moment."
      : "Hey! I'd love to learn about your product so we can tailor ECP for you. What does your product do?";

  const [messages, setMessages] = useState<Msg[]>(
    initialMessagesProp && initialMessagesProp.length > 0
      ? initialMessagesProp
      : [{ role: "assistant", content: initialMessage, timestamp: new Date() }]
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const hasExistingContext = !!(data.product_description || data.audience || data.goals);
  const [contextReady, setContextReady] = useState(hasExistingContext);
  const [analyticsMode, setAnalyticsMode] = useState(hasExistingContext);
  const initialConfidence = hasExistingContext ? 100 : (savedConfidence ?? 0);
  const [aiConfidence, setAiConfidence] = useState(initialConfidence);
  const [hasAutoSent, setHasAutoSent] = useState(false);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load user's model preference
  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const { data } = await supabase.from("profiles").select("onboarding_data").eq("user_id", session.user.id).single();
        const llm = (data?.onboarding_data as any)?.llm_config;
        if (llm?.provider && llm.provider !== "default") {
          const providerLabel = { openai: "OpenAI", anthropic: "Anthropic", google: "Google" }[llm.provider] || llm.provider;
          setActiveModel(`${providerLabel} · ${llm.model || "default"}`);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount / reset
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Persist messages to parent when they change
  useEffect(() => {
    if (onMessagesChange && messages.length > 1) {
      onMessagesChange(messages.map((m) => ({ role: m.role, content: m.content })));
    }
  }, [messages, onMessagesChange]);

  // Auto-trigger the AI to analyze codebase on mount when repo context is available
  useEffect(() => {
    if (repoContext && !hasAutoSent && !contextReady) {
      setHasAutoSent(true);
      // Send a silent "analyze my codebase" message to trigger the AI's interpretation
      const autoMsg: Msg = { role: "user", content: "Hey, I just connected my repo. Tell me what you see.", timestamp: new Date() };
      const allMessages = [messages[0], autoMsg];
      setMessages(allMessages);
      setIsLoading(true);

      (async () => {
        let assistantSoFar = "";
        try {
          const { data: sessionData } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
          const token = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

          const resp = await fetch(CHAT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ messages: allMessages, repo_context: repoContext }),
          });

          if (!resp.ok) {
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
              if (last?.role === "assistant" && prev.length > allMessages.length) {
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
              } catch { textBuffer = line + "\n" + textBuffer; break; }
            }
          }

          // Parse and save PARTIAL_CONTEXT from codebase analysis
          const partialMatch = assistantSoFar.match(/PARTIAL_CONTEXT:\s*(\{[\s\S]*?\})(?=\s*(?:CONFIDENCE|CONTEXT_COMPLETE|$))/);
          if (partialMatch) {
            try {
              const partial = JSON.parse(partialMatch[1]);
              const partialBusiness: Record<string, string | undefined> = {};
              for (const key of ["product_description", "audience", "goals", "stage", "challenges"]) {
                const val = partial[key];
                if (val && val !== "null" && val !== "...or null") {
                  partialBusiness[key] = val;
                }
              }
              if (Object.keys(partialBusiness).length > 0) {
                onUpdate(partialBusiness);
                onFinish(partialBusiness);
              }
            } catch { /* skip */ }
            assistantSoFar = assistantSoFar.replace(/\n?PARTIAL_CONTEXT:\s*\{[\s\S]*?\}(?=\s*(?:CONFIDENCE|CONTEXT_COMPLETE|$))/, "");
          }

          // Parse confidence
          const confidenceMatch = assistantSoFar.match(/CONFIDENCE:(\d+)\s*$/);
          if (confidenceMatch) {
            const conf = Math.min(100, Math.max(0, parseInt(confidenceMatch[1], 10)));
            setAiConfidence(conf);
            onConfidenceChange?.(conf);
            assistantSoFar = assistantSoFar.replace(/\nCONFIDENCE:\d+\s*$/, '').replace(/CONFIDENCE:\d+\s*$/, '');
          }
          setMessages((prev) =>
            prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m))
          );

          // Hide the auto user message from the UI
          setMessages((prev) => prev.filter((m) => m.content !== "Hey, I just connected my repo. Tell me what you see."));
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [repoContext]);

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

      // Use session token if available for authenticated data access
      const { data: sessionData } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      const token = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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

      // Parse and strip PARTIAL_CONTEXT, CONFIDENCE, CONTEXT_COMPLETE from response
      let cleanedText = assistantSoFar;

      // 1. Parse PARTIAL_CONTEXT — save incrementally
      const partialMatch = cleanedText.match(/PARTIAL_CONTEXT:\s*(\{[\s\S]*?\})(?=\s*(?:CONFIDENCE|CONTEXT_COMPLETE|$))/);
      if (partialMatch) {
        try {
          const partial = JSON.parse(partialMatch[1]);
          const partialBusiness: Record<string, string | undefined> = {};
          for (const key of ["product_description", "audience", "goals", "stage", "challenges"]) {
            const val = partial[key];
            if (val && val !== "null" && val !== "...or null") {
              partialBusiness[key] = val;
            }
          }
          if (Object.keys(partialBusiness).length > 0) {
            onUpdate(partialBusiness);
            // Auto-save partial context in background
            onFinish(partialBusiness);
          }
        } catch { /* skip bad JSON */ }
        cleanedText = cleanedText.replace(/\n?PARTIAL_CONTEXT:\s*\{[\s\S]*?\}(?=\s*(?:CONFIDENCE|CONTEXT_COMPLETE|$))/, "");
      }

      // 2. Parse CONFIDENCE
      const confidenceMatch = cleanedText.match(/CONFIDENCE:(\d+)\s*$/);
      if (confidenceMatch) {
        const conf = Math.min(100, Math.max(0, parseInt(confidenceMatch[1], 10)));
        setAiConfidence(conf);
        onConfidenceChange?.(conf);
        cleanedText = cleanedText.replace(/\nCONFIDENCE:\d+\s*$/, '').replace(/CONFIDENCE:\d+\s*$/, '');
      }

      // 3. Parse CONTEXT_COMPLETE — transition to analytics mode
      const contextMatch = cleanedText.match(/CONTEXT_COMPLETE:\s*(\{[\s\S]*?\})(?=\s*CONFIDENCE:|$)/);
      if (contextMatch) {
        try {
          const parsed = JSON.parse(contextMatch[1]);
          const parsedBusiness = {
            product_description: parsed?.product_description,
            audience: parsed?.audience,
            goals: parsed?.goals,
            stage: parsed?.stage,
            challenges: parsed?.challenges,
          };

          onUpdate(parsedBusiness);
          setContextReady(true);
          setAiConfidence(100);
          onConfidenceChange?.(100);

          cleanedText = cleanedText
            .replace(/\n?CONTEXT_COMPLETE:\s*\{[\s\S]*?\}(?=\s*CONFIDENCE:|$)/, "")
            .replace(/\nCONFIDENCE:\d+\s*$/, "")
            .trim() || "Great, I've got a good understanding of your business! You're all set.";

          cleanedText += "\n\n✨ **You can now ask me analytics questions!** I'll use your business context to give tailored insights about your events, metrics, and tracking strategy.";

          // Auto-save final context
          setTimeout(() => onFinish(parsedBusiness), 500);
        } catch {
          // AI didn't return valid JSON, that's ok
        }
      }

      // Update displayed message with cleaned text (no tags)
      assistantSoFar = cleanedText.trim();
      setMessages((prev) =>
        prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m))
      );
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
            <span className="text-xs font-medium text-muted-foreground">
              {contextReady ? "Analytics Assistant" : "Business Understanding"}
            </span>
            <div className="flex-1" />
            <Badge variant="outline" className="text-xs font-mono px-2 py-0.5">
              {contextReady ? "Ready" : `${understanding}%`}
            </Badge>
            <div className="flex items-center gap-2 shrink-0">
              {activeModel && (
                <Badge variant="outline" className="text-[10px] font-mono gap-1 px-1.5 py-0.5">
                  <Cpu className="h-2.5 w-2.5" />
                  {activeModel}
                </Badge>
              )}
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
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm font-['Mona_Sans',sans-serif] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <ChatMessageContent content={msg.content} />
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

        {/* Prompt suggestions + Input area */}
        <div className="border-t border-border bg-background px-4 py-3">
          <div className="max-w-2xl mx-auto space-y-3">
            {messages.length <= 2 && !isLoading && (
              <div className="flex flex-wrap gap-2 justify-center">
                {contextReady ? (
                  <>
                    <PromptSuggestion onClick={() => { setInput("How many visitors hit my landing page this week?"); }}>How many visitors this week?</PromptSuggestion>
                    <PromptSuggestion onClick={() => { setInput("Show me top events by count"); }}>Top events by count</PromptSuggestion>
                    <PromptSuggestion onClick={() => { setInput("What's my signup conversion rate?"); }}>Signup conversion rate</PromptSuggestion>
                    <PromptSuggestion onClick={() => { setInput("Show me daily active users trend"); }}>DAU trend</PromptSuggestion>
                  </>
                ) : (
                  <>
                    <PromptSuggestion onClick={() => { setInput("We're building a SaaS for small businesses"); }}>Describe my product</PromptSuggestion>
                    <PromptSuggestion onClick={() => { setInput("Our target audience is startup founders"); }}>Define my audience</PromptSuggestion>
                    <PromptSuggestion onClick={() => { setInput("We want to increase user retention"); }}>Share my goals</PromptSuggestion>
                  </>
                )}
              </div>
            )}
            <div className="relative">
              <Textarea
                ref={inputRef}
                className="min-h-[80px] max-h-[160px] resize-none rounded-xl pr-12 text-sm"
                placeholder={contextReady ? "Type a message or click a suggestion..." : "Tell us about your business..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    send();
                  } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    onNewChat?.();
                  }
                }}
                disabled={isLoading}
              />
              <Button
                size="icon"
                className="absolute bottom-2 right-2 rounded-full h-8 w-8"
                onClick={send}
                disabled={isLoading || !input.trim()}
              >
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
                    <ChatMessageContent content={msg.content} />
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

        <div className="border-t border-border p-3">
          <div className="relative">
            <Textarea
              className="min-h-[60px] max-h-[120px] resize-none rounded-xl pr-12 text-sm"
              placeholder={contextReady ? "Ask about analytics..." : "Type your answer..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              disabled={isLoading}
            />
            <Button size="icon" className="absolute bottom-2 right-2 rounded-full h-8 w-8" onClick={send} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {!inline && (
        <div className="flex justify-center gap-3 pt-2">
          {contextReady ? (
            <Button onClick={() => onFinish()} disabled={isSubmitting}>
              {isSubmitting ? "Finishing..." : "Finish Setup"}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onFinish()} disabled={isSubmitting}>
              Skip & Finish
            </Button>
          )}
        </div>
      )}
      {inline && contextReady && (
        <div className="pt-2">
          <Button size="sm" onClick={() => onFinish()} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Context"}
          </Button>
        </div>
      )}
    </div>
  );
}
