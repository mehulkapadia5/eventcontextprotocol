import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Code2, Check } from "lucide-react";

interface StepCodebaseProps {
  data: { github_url?: string };
  onUpdate: (data: { github_url?: string }) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function StepCodebase({ data, onUpdate, onNext, onSkip }: StepCodebaseProps) {
  const [showInput, setShowInput] = useState(false);
  const isConnected = !!data.github_url;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Code2 className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Connect Codebase</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Link your GitHub repository so ECP can provide code-aware insights and context.
        </p>
      </div>

      <div className="max-w-lg mx-auto">
        <Card className={isConnected ? "border-primary" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">GitHub</CardTitle>
                <CardDescription>Connect your repository</CardDescription>
              </div>
              {isConnected ? (
                <div className="flex items-center gap-1 text-sm text-primary">
                  <Check className="h-4 w-4" /> Connected
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowInput(!showInput)}>
                  {showInput ? "Cancel" : "Connect Repository"}
                </Button>
              )}
            </div>
          </CardHeader>
          {(showInput || isConnected) && (
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Input
                  placeholder="https://github.com/org/repo"
                  value={data.github_url || ""}
                  onChange={(e) => onUpdate({ github_url: e.target.value })}
                />
                {!isConnected && (
                  <Button
                    size="sm"
                    disabled={!data.github_url}
                    onClick={() => setShowInput(false)}
                  >
                    Save
                  </Button>
                )}
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
