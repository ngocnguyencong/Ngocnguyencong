import { setupGuidance } from "../src/setup-content";

function SetupSection({ items, title }: Readonly<{ items: readonly string[]; title: string }>) {
  return (
    <section>
      <h2>{title}</h2>
      <ol>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}

export default function DocsHome() {
  return (
    <main>
      <h1>supastack setup</h1>
      <p>
        Start locally with fake adapters. Real providers are optional and belong to a separate
        credential-gated smoke path.
      </p>
      <SetupSection items={setupGuidance.local.steps} title={setupGuidance.local.title} />
      <SetupSection items={setupGuidance.agent.steps} title={setupGuidance.agent.title} />
      <SetupSection
        items={setupGuidance.providers.prerequisites}
        title={setupGuidance.providers.title}
      />
      <p>
        Run <code>{setupGuidance.providers.command}</code> only after placing credentials in your
        platform secret store. Follow <code>{setupGuidance.providers.runbook}</code> for webhook
        replay and timing evidence.
      </p>
    </main>
  );
}
