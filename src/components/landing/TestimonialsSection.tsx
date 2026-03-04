import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const testimonials = [
  {
    quote: "Magnitude replaced three tools for us. We finally understand what our users actually do — without writing a single query.",
    name: "Sarah Chen",
    role: "Head of Product",
    company: "Flowstack",
    initials: "SC",
  },
  {
    quote: "I used to wait days for our data team to pull reports. Now I just ask Magnitude in plain English and get answers instantly.",
    name: "James Okafor",
    role: "Product Manager",
    company: "Nuvio",
    initials: "JO",
  },
  {
    quote: "Setting up took five minutes. The AI insights surfaced a churn pattern we'd missed for months. Absolute game-changer.",
    name: "Maria Lindström",
    role: "Co-Founder",
    company: "Peakly",
    initials: "ML",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 border-t border-border">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
            Loved by product teams
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See why teams are switching to Magnitude for their product analytics.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <Card key={t.name} className="bg-card border-border">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-6 italic">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">{t.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium leading-none">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.role}, {t.company}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
