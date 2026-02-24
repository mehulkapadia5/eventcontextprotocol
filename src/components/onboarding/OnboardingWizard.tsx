import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StepAnalytics } from "./StepAnalytics";
import { StepCodebase } from "./StepCodebase";
import { StepBusinessContext } from "./StepBusinessContext";

interface OnboardingWizardProps {
  userId: string;
  onComplete: () => void;
}

export function OnboardingWizard({ userId, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<{ posthog_key?: string; mixpanel_key?: string }>({});
  const [codebaseData, setCodebaseData] = useState<{ github_url?: string }>({});
  const [businessData, setBusinessData] = useState<{ product_description?: string; audience?: string; goals?: string }>({});

  const steps = ["Connect Analytics", "Connect Codebase", "Business Context"];
  const progress = ((step + 1) / steps.length) * 100;

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      const onboardingData = {
        analytics: analyticsData,
        codebase: codebaseData,
        business: businessData,
      };
      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          onboarding_data: onboardingData,
        } as any)
        .eq("user_id", userId);

      if (error) throw error;
      toast.success("Setup complete! Welcome to ECP.");
      onComplete();
    } catch (err) {
      toast.error("Failed to save. Please try again.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-mono font-bold text-lg">ECP</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Step {step + 1} of {steps.length} — {steps[step]}
          </p>
          <Progress value={progress} className="h-1.5 max-w-xs mx-auto" />
        </div>

        {/* Steps */}
        {step === 0 && (
          <StepAnalytics
            data={analyticsData}
            onUpdate={setAnalyticsData}
            onNext={() => setStep(1)}
            onSkip={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <StepCodebase
            data={codebaseData}
            onUpdate={setCodebaseData}
            onNext={() => setStep(2)}
            onSkip={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepBusinessContext
            data={businessData}
            onUpdate={setBusinessData}
            onFinish={handleFinish}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
