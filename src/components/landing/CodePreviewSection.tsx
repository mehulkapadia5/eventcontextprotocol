import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const codeExamples = {
  install: `npm install @ecp/sdk`,
  init: `import { ECP } from '@ecp/sdk';

// Initialize with your project API key
const tracker = new ECP('ecp_ak_xxxxxxxxxxxx');`,
  track: `// Track a custom event
tracker.track('purchase_completed', {
  product_id: 'prod_123',
  amount: 49.99,
  currency: 'USD',
});

// Track with user identity
tracker.identify('user_456');
tracker.track('page_viewed', {
  path: '/dashboard',
  referrer: 'google.com',
});`,
  api: `// Or use the REST API directly
curl -X POST https://your-project.ecp.dev/v1/events \\
  -H "Authorization: Bearer ecp_ak_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_name": "signup_completed",
    "user_identifier": "user_789",
    "properties": { "plan": "pro" }
  }'`,
};

export function CodePreviewSection() {
  return (
    <section id="sdk" className="py-24 border-t border-border">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
            Integrate in minutes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Three lines of code to start tracking. Use the SDK or hit the API directly.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Tabs defaultValue="track" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="install">Install</TabsTrigger>
              <TabsTrigger value="init">Initialize</TabsTrigger>
              <TabsTrigger value="track">Track Events</TabsTrigger>
              <TabsTrigger value="api">REST API</TabsTrigger>
            </TabsList>
            {Object.entries(codeExamples).map(([key, code]) => (
              <TabsContent key={key} value={key}>
                <div className="rounded-lg border border-border bg-card p-6 font-mono text-sm">
                  <pre className="text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                    <code>{code}</code>
                  </pre>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </section>
  );
}
