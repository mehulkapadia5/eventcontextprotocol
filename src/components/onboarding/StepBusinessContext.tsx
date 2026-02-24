import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Briefcase } from "lucide-react";

interface StepBusinessContextProps {
  data: { product_description?: string; audience?: string; goals?: string };
  onUpdate: (data: { product_description?: string; audience?: string; goals?: string }) => void;
  onFinish: () => void;
  isSubmitting: boolean;
}

export function StepBusinessContext({ data, onUpdate, onFinish, isSubmitting }: StepBusinessContextProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Briefcase className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Business Context</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Tell us about your product so ECP can tailor insights and recommendations.
        </p>
      </div>

      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product">What does your product do?</Label>
            <Textarea
              id="product"
              placeholder="Describe your product in a few sentences..."
              value={data.product_description || ""}
              onChange={(e) => onUpdate({ ...data, product_description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audience">Target audience</Label>
            <Input
              id="audience"
              placeholder="e.g. B2B SaaS teams, mobile gamers, e-commerce shoppers"
              value={data.audience || ""}
              onChange={(e) => onUpdate({ ...data, audience: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goals">Primary goals</Label>
            <Textarea
              id="goals"
              placeholder="What are you trying to achieve with event tracking?"
              value={data.goals || ""}
              onChange={(e) => onUpdate({ ...data, goals: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center pt-4">
        <Button onClick={onFinish} disabled={isSubmitting}>
          {isSubmitting ? "Finishing..." : "Finish Setup"}
        </Button>
      </div>
    </div>
  );
}
