const STEPS = [
  {
    n: "01",
    title: "Choose your job role",
    desc: "Pick from IT support, software, networking, security, and more.",
  },
  {
    n: "02",
    title: "Answer interview questions",
    desc: "AI-generated questions tailored to your role and experience level.",
  },
  {
    n: "03",
    title: "Receive AI feedback",
    desc: "Get clarity, structure, and role-specific scores with concrete tips.",
  },
  {
    n: "04",
    title: "Track your improvement",
    desc: "Watch your readiness score climb session over session.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-surface py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">How it works</h2>
          <p className="mt-3 text-muted-foreground">
            Four simple steps from setup to a job-ready answer.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-border bg-card p-6">
              <div className="font-display text-3xl font-bold text-primary-gradient">{s.n}</div>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
