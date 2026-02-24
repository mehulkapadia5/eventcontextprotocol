import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, Key, Save, Loader2, CheckCircle2, Trash2 } from "lucide-react";

interface LlmConfig {
  provider?: string;
  model?: string;
  openai_key?: string;
  anthropic_key?: string;
  google_key?: string;
}

const MODELS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
  openai: {
    label: "OpenAI",
    models: [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "o1", label: "o1" },
      { value: "o1-mini", label: "o1 Mini" },
      { value: "o3-mini", label: "o3 Mini" },
    ],
  },
  anthropic: {
    label: "Anthropic",
    models: [
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
      { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
      { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
    ],
  },
  google: {
    label: "Google",
    models: [
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
  },
};

export function SettingsPage() {
  const { session } = useAuth();
  const [config, setConfig] = useState<LlmConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("user_id", session.user.id)
        .single();
      const od = data?.onboarding_data as any;
      if (od?.llm_config) setConfig(od.llm_config);
      setLoading(false);
    })();
  }, [session?.user?.id]);

  const handleSave = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      const { data: current } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("user_id", session.user.id)
        .single();
      const od = (current?.onboarding_data as any) || {};
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_data: { ...od, llm_config: config } } as any)
        .eq("user_id", session.user.id);
      if (error) throw error;
      toast.success("Settings saved!");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearKey = (provider: string) => {
    const keyField = `${provider}_key` as keyof LlmConfig;
    setConfig((prev) => {
      const updated = { ...prev, [keyField]: undefined };
      if (prev.provider === provider) {
        updated.provider = undefined;
        updated.model = undefined;
      }
      return updated;
    });
  };

  const maskKey = (key?: string) => {
    if (!key) return "";
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
  };

  const activeProvider = config.provider;
  const availableModels = activeProvider ? MODELS[activeProvider]?.models || [] : [];
  const hasAnyKey = !!(config.openai_key || config.anthropic_key || config.google_key);

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure your own AI provider keys for unlimited usage. Without a key, the platform's shared quota is used.
        </p>
      </div>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            AI Provider Keys
          </CardTitle>
          <CardDescription>
            Add your own API keys to bypass shared rate limits. Your keys are stored securely and never shared.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(MODELS).map(([providerId, providerInfo]) => {
            const keyField = `${providerId}_key` as keyof LlmConfig;
            const keyValue = config[keyField] as string | undefined;
            const isVisible = showKeys[providerId];

            return (
              <div key={providerId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{providerInfo.label} API Key</Label>
                  <div className="flex items-center gap-1">
                    {keyValue && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Connected
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={isVisible ? "text" : "password"}
                      placeholder={`Enter your ${providerInfo.label} API key`}
                      value={keyValue || ""}
                      onChange={(e) => setConfig((prev) => ({ ...prev, [keyField]: e.target.value || undefined }))}
                      className="pr-10 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }))}
                    >
                      {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {keyValue && (
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleClearKey(providerId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model Preference</CardTitle>
          <CardDescription>
            Choose which provider and model to use for AI chat. Only providers with a configured key are available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={activeProvider || "default"}
              onValueChange={(v) => {
                if (v === "default") {
                  setConfig((prev) => ({ ...prev, provider: undefined, model: undefined }));
                } else {
                  setConfig((prev) => ({ ...prev, provider: v, model: MODELS[v]?.models[0]?.value }));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Platform Default (Shared)</SelectItem>
                {Object.entries(MODELS).map(([id, info]) => {
                  const hasKey = !!(config[`${id}_key` as keyof LlmConfig]);
                  return (
                    <SelectItem key={id} value={id} disabled={!hasKey}>
                      {info.label} {!hasKey && "(no key)"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {activeProvider && availableModels.length > 0 && (
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={config.model || availableModels[0]?.value}
                onValueChange={(v) => setConfig((prev) => ({ ...prev, model: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!activeProvider && (
            <p className="text-xs text-muted-foreground">
              Using the platform's shared AI (Google Gemini 3 Flash). Add your own key above for unlimited usage.
            </p>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save Settings</>}
      </Button>
    </div>
  );
}
