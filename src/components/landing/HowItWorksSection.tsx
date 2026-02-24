const steps = [
  {
    number: "01",
    title: "Create a Project",
    description: "Sign up and create a project. You'll get a unique API key instantly.",
  },
  {
    number: "02",
    title: "Install the SDK",
    description: "Add the SDK to your app with npm install. Initialize with your API key.",
  },
  {
    number: "03",
    title: "Track Events",
    description: "Call tracker.track() wherever something interesting happens in your app.",
  },
  {
    number: "04",
    title: "View Your Dashboard",
    description: "Watch events flow in real-time. Analyze trends, filter data, and export reports.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 border-t border-border">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
            How it works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From zero to analytics in under five minutes.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col gap-3">
              <span className="font-mono text-3xl font-bold text-primary">{step.number}</span>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
