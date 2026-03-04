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
    <section className="px-6 md:px-12 py-24" style={{ fontFamily: "'Mona Sans', sans-serif", borderTop: "1px solid rgba(10,10,15,0.10)" }}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-center font-bold mb-3" style={{ fontSize: "clamp(28px, 3vw, 40px)", letterSpacing: "-1px", color: "#0a0a0f" }}>
          Loved by product teams
        </h2>
        <p className="text-center mb-12" style={{ color: "#7c7c8a", fontSize: 16 }}>
          See why teams are switching to Magnitude for their product analytics.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-xl p-6"
              style={{ background: "#ffffff", border: "1px solid rgba(10,10,15,0.10)" }}
            >
              <p className="text-sm italic flex-1 mb-6" style={{ color: "#7c7c8a", lineHeight: 1.7 }}>
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3 mt-auto">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={t.image} alt={t.name} />
                  <AvatarFallback className="text-xs">{t.initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium leading-none" style={{ color: "#0a0a0f" }}>{t.name}</p>
                  <p className="text-xs mt-1" style={{ color: "#7c7c8a" }}>{t.role}, {t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
