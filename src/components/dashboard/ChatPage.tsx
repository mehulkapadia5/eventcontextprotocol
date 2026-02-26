import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StepBusinessContext } from "@/components/onboarding/StepBusinessContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Plus, Trash2, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingData {
  analytics?: { posthog_key?: string; mixpanel_key?: string };
  codebase?: { github_url?: string; github_pat?: string };
  business?: { product_description?: string; audience?: string; goals?: string; [key: string]: string | undefined };
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function ChatPage() {
  const { session } = useAuth();
  const [data, setData] = useState<OnboardingData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [repoContext, setRepoContext] = useState<string | null>(null);
  const [savedConfidence, setSavedConfidence] = useState(0);

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<{ role: "user" | "assistant"; content: string; timestamp: Date }[] | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_data")
      .eq("user_id", session.user.id)
      .single();
    const od = (profile as any)?.onboarding_data as OnboardingData | null;
    if (od) {
      setData(od);
      setSavedConfidence((od as any).ai_confidence ?? 0);
      if ((od.codebase as any)?.context) {
        setRepoContext((od.codebase as any).context);
      } else if (od.codebase?.github_url) {
        fetchGitHubContext(od.codebase.github_url, od.codebase.github_pat);
      }
    }
    setLoading(false);
  }, [session?.user?.id]);

  const fetchGitHubContext = async (githubUrl: string, githubPat?: string) => {
    try {
      const { data: ctx, error } = await supabase.functions.invoke("fetch-github-context", {
        body: { github_url: githubUrl, github_pat: githubPat },
      });
      if (error) throw error;
      if (ctx && !ctx.error) {
        const summary = [
          `Repository: ${ctx.repo}`,
          ctx.description ? `Description: ${ctx.description}` : "",
          ctx.language ? `Primary language: ${ctx.language}` : "",
          ctx.topics?.length ? `Topics: ${ctx.topics.join(", ")}` : "",
          `File tree (${ctx.file_tree?.length || 0} files): ${(ctx.file_tree || []).slice(0, 50).join(", ")}`,
          ...Object.entries(ctx.key_files || {}).map(
            ([path, content]) => `\n--- ${path} ---\n${(content as string).slice(0, 2000)}`
          ),
        ]
          .filter(Boolean)
          .join("\n");
        setRepoContext(summary);
        
        const { data: project } = await supabase.from("projects").select("id").eq("user_id", session?.user?.id).single();
        if (project?.id) {
          supabase.functions.invoke("discover-events", {
            body: { repo_context: summary, project_id: project.id }
          }).then(({ error }) => {
            if (!error) toast.success("Event discovery started based on your codebase.");
          });
        }

        if (session?.user?.id) {
          supabase.from("profiles").update({
            onboarding_data: {
              ...data,
              codebase: { ...data.codebase, context: summary },
            },
          } as any).eq("user_id", session.user.id).then(() => {});
        }
      }
    } catch (e) {
      console.warn("Failed to fetch GitHub context:", e);
    }
  };

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data: convs } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false });
    if (convs) setConversations(convs as Conversation[]);
  }, [session?.user?.id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Load messages for active conversation
  const loadConversation = useCallback(async (conversationId: string) => {
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (msgs && msgs.length > 0) {
      setInitialMessages(msgs.map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: new Date(m.created_at),
      })));
    } else {
      setInitialMessages(undefined);
    }
    setActiveConversationId(conversationId);
    setResetKey((k) => k + 1);
  }, []);

  // Create new conversation
  const handleNewChat = async () => {
    if (!session?.user?.id) return;
    const { data: conv, error } = await supabase
      .from("chat_conversations")
      .insert({ user_id: session.user.id, title: "New Chat" })
      .select()
      .single();
    if (error || !conv) {
      toast.error("Failed to create conversation");
      return;
    }
    setConversations((prev) => [conv as Conversation, ...prev]);
    setActiveConversationId(conv.id);
    setInitialMessages(undefined);
    setResetKey((k) => k + 1);
  };

  // Delete conversation
  const handleDeleteConversation = async (id: string) => {
    const remaining = conversations.filter((c) => c.id !== id);
    setConversations(remaining);
    // Delete messages first (foreign key constraint)
    await supabase.from("chat_messages").delete().eq("conversation_id", id);
    await supabase.from("chat_conversations").delete().eq("id", id);
    
    if (activeConversationId === id) {
      if (remaining.length > 0) {
        // Switch to the next conversation
        loadConversation(remaining[0].id);
      } else {
        // Create a fresh conversation
        handleNewChat();
      }
    }
  };

  // Save messages callback - called by StepBusinessContext after each exchange
  const handleMessagesChange = useCallback(async (messages: { role: "user" | "assistant"; content: string }[]) => {
    if (!session?.user?.id || !activeConversationId) return;
    // Only save user and assistant messages (skip system)
    const toSave = messages.filter((m) => m.role === "user" || m.role === "assistant");
    if (toSave.length === 0) return;

    // Delete existing messages and re-insert (simple approach)
    await supabase.from("chat_messages").delete().eq("conversation_id", activeConversationId);
    await supabase.from("chat_messages").insert(
      toSave.map((m) => ({
        conversation_id: activeConversationId,
        role: m.role,
        content: m.content,
      }))
    );

    // Update conversation title from first user message
    const firstUserMsg = toSave.find((m) => m.role === "user");
    if (firstUserMsg) {
      const title = firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? "..." : "");
      await supabase.from("chat_conversations").update({ title }).eq("id", activeConversationId);
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId ? { ...c, title, updated_at: new Date().toISOString() } : c))
      );
    }
  }, [session?.user?.id, activeConversationId]);

  // Auto-create first conversation if none exist
  useEffect(() => {
    if (!loading && session?.user?.id && conversations.length === 0 && !activeConversationId) {
      handleNewChat();
    } else if (!loading && conversations.length > 0 && !activeConversationId) {
      // Load most recent conversation
      loadConversation(conversations[0].id);
    }
  }, [loading, session?.user?.id, conversations.length]);

  const handleFinish = async (businessOverride?: { product_description?: string; audience?: string; goals?: string; [key: string]: string | undefined }) => {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      const finalData = businessOverride
        ? { ...data, business: { ...(data.business || {}), ...businessOverride } }
        : data;

      const analytics = finalData.analytics as any;
      const hasAnalytics = !!(analytics?.posthog_key || analytics?.posthog_personal_key || analytics?.mixpanel_key || analytics?.mixpanel_secret || analytics?.ga4_property_id);
      const allDone = hasAnalytics &&
        !!finalData.codebase?.github_url &&
        !!finalData.business?.product_description;

      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_data: finalData,
          onboarding_completed: allDone,
        } as any)
        .eq("user_id", session.user.id);
      if (error) throw error;
      if (businessOverride) setData(finalData);
      toast.success("Business context saved!");

      // Enrich event dictionary with business context in the background
      const businessCtx = finalData.business || businessOverride;
      if (businessCtx?.product_description) {
        const { data: project } = await supabase.from("projects").select("id").eq("user_id", session.user.id).single();
        if (project?.id) {
          supabase.functions.invoke("enrich-event-dictionary", {
            body: { project_id: project.id, business_context: businessCtx },
          }).then(({ data: result, error: enrichErr }) => {
            if (!enrichErr && result?.enriched > 0) {
              toast.success(`Enriched ${result.enriched} events with business context`);
            }
          });
        }
      }
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearContext = async () => {
    if (!session?.user?.id) return;
    try {
      const updated = { ...data, business: {}, ai_confidence: 0 };
      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_data: updated,
          onboarding_completed: false,
        } as any)
        .eq("user_id", session.user.id);
      if (error) throw error;
      setData(updated);
      setSavedConfidence(0);
      setResetKey((k) => k + 1);
      toast.success("Context cleared. Start a new conversation.");
    } catch {
      toast.error("Failed to clear context.");
    }
  };

  const handleConfidenceChange = async (confidence: number) => {
    setSavedConfidence(confidence);
    if (!session?.user?.id) return;
    supabase.from("profiles").update({
      onboarding_data: { ...data, ai_confidence: confidence },
    } as any).eq("user_id", session.user.id).then(() => {});
  };

  if (loading) return <div className="flex-1" />;

  return (
    <div className="flex h-[calc(100vh)] -m-6 md:-m-8 overflow-hidden">
      {/* Sidebar */}
      <div
        className={cn(
          "border-r border-border bg-card flex flex-col transition-all duration-200",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        )}
      >
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleNewChat}>
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-2 space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors overflow-hidden",
                  activeConversationId === conv.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
                onClick={() => loadConversation(conv.id)}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="flex-1 min-w-0 truncate pr-1">{conv.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-100 text-foreground/80 hover:text-foreground hover:bg-background/80 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conv.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!sidebarOpen && (
          <div className="absolute top-[4.5rem] left-[1rem] md:left-[17.5rem] z-10">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
        <StepBusinessContext
          key={resetKey}
          data={data.business || {}}
          onUpdate={(biz) => setData((prev) => ({ ...prev, business: biz }))}
          onFinish={handleFinish}
          onClearContext={handleClearContext}
          isSubmitting={saving}
          fullPage
          repoContext={repoContext}
          savedConfidence={savedConfidence}
          onConfidenceChange={handleConfidenceChange}
          initialMessages={initialMessages}
          onMessagesChange={handleMessagesChange}
        />
      </div>
    </div>
  );
}
