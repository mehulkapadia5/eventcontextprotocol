import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What analytics tools do you support?",
    a: "Magnitude integrates with Mixpanel, PostHog, Google Analytics, and more. Connect your existing tools in minutes — no migration needed.",
  },
  {
    q: "Do I need to write any code?",
    a: "No. Magnitude is built for product managers and founders. Just connect your tools, link your codebase via GitHub, and start asking questions in plain English.",
  },
  {
    q: "How is my data secured?",
    a: "Every project's data is fully isolated with its own API key. We use enterprise-grade encryption and comply with industry security standards.",
  },
  {
    q: "What regions is my data hosted in?",
    a: "Magnitude supports data hosting in both the United States and the European Union, so you can stay compliant with local regulations.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes! You can get started for free and scale as your team grows. No credit card required.",
  },
  {
    q: "How does the AI analysis work?",
    a: "Magnitude connects your analytics data with your codebase context. When you ask a question, the AI cross-references event data, code changes, and business context to give you actionable answers.",
  },
];

export function FAQSection() {
  return (
    <section className="py-24 border-t border-border">
      <div className="container max-w-3xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
            Frequently asked questions
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to know about Magnitude.
          </p>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
