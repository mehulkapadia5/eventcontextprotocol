import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import marishImg from "@/assets/testimonial-marish.png";
import richardImg from "@/assets/testimonial-richard.png";

const testimonials = [
  {
    quote: "This is crazy man, I was analysing my funnel and realised I had mistakenly unlocked a paid feature for free users accidentally. Loved it!",
    name: "Marish Asudani",
    role: "Co-Founder",
    company: "USMLEVault",
    image: marishImg,
    initials: "MA",
  },
  {
    quote: "This makes my life so much simpler. Back in the day we had to hire a huge data analytics team, instrument products and have analyst team take weeks to get data — I'm doing it in seconds using simple prompts. This saves us thousands of dollars and countless man hours. Can't go back to older tools.",
    name: "Richard Davidson",
    role: "Ex-Director, Business Development",
    company: "GetInsured",
    image: richardImg,
    initials: "RD",
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
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {testimonials.map((t) => (
            <Card key={t.name} className="bg-card border-border flex flex-col">
              <CardContent className="pt-6 flex flex-col flex-1">
                <p className="text-sm text-muted-foreground mb-6 italic flex-1">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3 mt-auto">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={t.image} alt={t.name} />
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
