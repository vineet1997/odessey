import { useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { PrologueField } from "./PrologueField";

const sourceUrl = "https://github.com/vineet1997/odessey";

/** Public build record: decisions, constraints, and the evidence behind them. */
export function MadePage() {
  useEffect(() => {
    const previous = document.title;
    document.title = "How I Built Ithaka | A cinema decision engine";
    return () => { document.title = previous; };
  }, []);

  return (
    <main className="made-page min-h-screen overflow-x-hidden bg-bg text-ink">
      <Header />
      <Hero />
      <Article />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#090e15]/95 text-[#e9e4d8] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="/" className="font-mono text-[10px] font-medium uppercase tracking-[0.17em] text-[#e9e4d8]">Ithaka <span className="text-[#e3c158]">/ Build log</span></a>
        <a href="/" className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.13em] text-[#e9e4d8] transition-colors hover:border-[#e3c158] hover:text-[#e3c158] sm:px-4">
          Find your screen <ArrowLeft size={13} className="rotate-180" />
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="border-b border-border bg-bg">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase text-gold-bright">Engineering note · 10 minute read</p>
          <h1 className="mt-6 max-w-[12ch] font-display text-[clamp(3rem,7vw,6rem)] leading-[0.94]">How I built a cinema decision engine for one film.</h1>
          <p className="mt-7 max-w-[38rem] font-body text-[clamp(1.1rem,2vw,1.35rem)] leading-relaxed text-ink">Ithaka turns live showtimes, venue evidence, travel constraints, and the journey home into one recommendation for <em>The Odyssey</em> in Delhi NCR.</p>
          <p className="mt-6 max-w-[38rem] font-body leading-relaxed text-ink-muted">This is a build record, not a retrospective victory lap: the first model, the real cases that broke its assumptions, and the architecture needed to make one answer worth defending.</p>
        </div>
        <figure className="relative h-[320px] overflow-hidden rounded-sm bg-[#132c2d] shadow-sm sm:h-[430px]" aria-label="Interactive image collage from Ithaka's entrance">
          <PrologueField contained />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-[linear-gradient(transparent,rgba(7,16,20,0.75))] px-5 pb-5 pt-14">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/85">The entrance field · move across the image</p>
          </div>
        </figure>
      </div>
    </section>
  );
}

function Article() {
  return (
    <article className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
      <Intro />

      <Section number="01" title="The problem">
        <p>When I started looking for a place to watch <em>The Odyssey</em>, every cinema site could list shows. None could answer the actual question: <em>which show is worth taking once picture quality, ticket price, travel time, and getting home are all true at once?</em></p>
        <p>The first product decision followed from that: Ithaka would not become a better directory. It would make a recommendation and show enough of its working for that recommendation to be trusted.</p>
      </Section>

      <Section number="02" title="The initial solution">
        <p>The first useful abstraction was simple: the unit of choice is <strong>venue × format × showtime</strong>. That is the smallest unit that can carry a screen, a ticket price, an outbound trip, a film end, and a route home.</p>
        <DecisionVisual />
        <p>It meant scoring every viable show rather than selecting one preferred show from each venue. Priya at 6:30 AM, Priya later in a different format, and another cinema at the same time are different plans. This made the first engine honest enough to compare a complete night, not a list of theatres.</p>
        <Aside title="What the first model got right">Venue, format, and showtime were necessary. They were not sufficient. The difficult work began when real people exposed the assumptions hidden between them.</Aside>
      </Section>

      <Section number="03" title="The initial build">
        <p>Once the model was clear, the next question was data: what belongs in the build, and what must be checked for a specific person? The answer was shaped by cost, reliability, and the narrow Delhi NCR release.</p>
        <p>District won the showtime-source research because its cinema pages exposed structured session data in server-rendered Next.js payloads. BookMyShow was more bot-protected and redundant for this scope. A District scraper writes versioned JSON on a schedule; the static app deploys from that file.</p>
        <ArchitectureVisual />
        <p>Google Routes is deliberately different. Showtimes are shared information; a trip from someone’s locality to a venue is personal and time-sensitive. The app calls the route function only when that information can change an answer, and keeps the server key off the client.</p>
        <Aside title="The architecture rule">Most of Ithaka is a newspaper delivered on a schedule. It becomes live only at the boundary where a person’s route changes the recommendation.</Aside>
      </Section>

      <Section number="04" title="Product evolution">
        <p>The first engine could rank plans. Real cases showed that ranking alone was not intelligence. A 6:30 AM show could win because it was cheap; a route home could point to the first metro after service resumed; a drive estimate made at request time could be wrong for a trip leaving hours later.</p>
        <p>Version 2 adds explicit, inspectable policy. Noon to 1 AM is the normal cinema window; 9 AM to noon is a morning edge case; pre-9 AM and post-1 AM stay outside the default answer. For <em>The Full Epic</em>, a morning IMAX can still be the stated compromise when normal-hour options would mean giving up the format.</p>
        <RuleEngineVisual />
        <p>The screen logic became similarly specific. An IMAX earns travel. Laser IMAX earns up to 30 additional outbound minutes over standard IMAX. A nearer, still-good screen is surfaced beside the chosen Full Epic rather than silently buried. The engine also distinguishes a metro-only return from cab fallback, forecasts driving at the planned leave and theatre-exit times, and lets people add constraints only after seeing the first answer.</p>
        <p>That evolution required more than new weights. It required complete plan scoring, exact venue-format evidence, a bounded live-route finalist pass, time-aware drive requests, and explicit evidence states for live metro, no route, and unverified data. One timezone bug reinforced the same principle: a technically valid value can still create an implausible night.</p>
        <Aside title="The debugging standard">The engine is tested in code, then tested against a human sentence: would somebody actually wake up, travel, and take this plan?</Aside>
      </Section>

      <Section number="05" title="The UX">
        <p>A recommendation with no explanation feels arbitrary. An explanation with every fact in the first viewport feels like homework. Ithaka uses progressive evidence: the answer first, the decisive comparison next, then counterfactuals and the full ledger for someone who wants to audit it.</p>
        <EvidenceVisual />
        <p>The details are product evidence, not decoration: exact format claims are limited to the evidence held for that venue and format; a cab is labelled an estimate; metro evidence is live, unavailable, or unverified; the full plan includes leaving home, arriving, film end, exit buffer, and getting back.</p>
        <p>The same principle changed the share artifact. The first version was an intelligent receipt. It proved the answer but gave nobody a reason to share it. The final Screening Declaration makes the person’s chosen night the subject; the explanatory machinery remains on the site for anyone who wants it.</p>
        <ShareRevision />
      </Section>

      <Section number="06" title="The UI">
        <p>The visual direction began with a simple problem: the input flow should feel like setting out on an expedition, but the result page should help someone make a decision. Those are different jobs, and they should not share the same level of spectacle.</p>
        <ArtVisual />
        <p>Reve generated options. Art direction chose the useful ones: a wide helmet composition for desktop, a portrait take for mobile and sharing, and a quieter treatment once the user reached the recommendation. Particle motion creates atmosphere at the entrance; it yields to touch, readability, reduced-motion preferences, and device limits.</p>
        <Aside title="The design rule">Cinematic continuity does not mean repeating the same effect. It means each surface belongs to the same world while doing its own job.</Aside>
      </Section>

      <Section number="07" title="The tech stack">
        <p>The stack follows the product boundary, not a desire to collect technologies. React, TypeScript, Vite, and Tailwind make a fast static decision surface. Vercel hosts it and exposes one server-side route boundary. District JSON is versioned in Git. GitHub Actions scrapes and commits it; Supabase Cron owns the dependable trigger. Google Routes is reserved for the personal part of the question.</p>
        <p>The refresh system deserves its own operational detail. GitHub’s shared scheduler did not fire reliably enough for a 30-minute data cadence, so Supabase Cron dispatches the GitHub Actions workflow instead. The Action still performs the scrape and versioned commit. It now rebases that data-only commit before pushing, because a human production deploy can arrive during the scrape.</p>
        <TechStackVisual />
        <p>Those choices were constrained on purpose: keep the Maps free-tier runway long, avoid a database and backend before they earn their complexity, never expose the route key, and keep the data path inspectable in a repository. Vitest covers the pure policy boundaries; a production build catches the UI and type contract.</p>
        <p>Claude and Codex were part of the studio, but not a magic prompt. The useful workflow was research → constraint → proposal → challenge → implementation → verification. Reve explored images; Claude helped with design and product reasoning; Codex implemented, reviewed, tested, and maintained the build record. The human work remained scope, taste, factual standards, and deciding when a result was actually done.</p>
        <WorkflowVisual />
        <Aside title="The durable lesson">AI made construction faster. It did not decide the constraints, the truth standard, or whether a technically correct answer made sense to a person.</Aside>
      </Section>

      <References />
    </article>
  );
}

function Intro() {
  return <div className="grid gap-7 border-b border-border py-16 sm:py-20 lg:grid-cols-[0.8fr_1.2fr]"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-bright">The short version</p><div className="font-body text-[1.2rem] leading-relaxed text-ink/90"><p>Ithaka was deliberately built for one film, one region, and one theatrical window. That constraint made the architecture sharper: static data where possible, live evidence only where it changes a recommendation, and policy that can be inspected when a neat score would otherwise make a strange human choice.</p><p className="mt-5 text-ink-muted">The rest of this article is the route from a simple first model to the system behind today’s answer.</p></div></div>;
}

function Section({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <section className="grid gap-7 border-b border-border py-16 sm:py-24 lg:grid-cols-[0.27fr_minmax(0,0.73fr)] lg:gap-14"><div><p className="font-mono text-[10px] tracking-[0.18em] text-gold-bright">{number}</p><h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.3rem)] leading-[0.95] tracking-[-0.03em]">{title}</h2></div><div className="space-y-6 font-body text-[1.08rem] leading-[1.7] text-ink/85">{children}</div></section>;
}

function Aside({ title, children }: { title: string; children: ReactNode }) {
  return <aside className="my-10 border-l-2 border-gold bg-gold/[0.045] px-5 py-5"><p className="font-mono text-[9px] uppercase tracking-[0.17em] text-gold-bright">{title}</p><p className="mt-3 font-body text-[1.05rem] leading-relaxed text-ink">{children}</p></aside>;
}

function DecisionVisual() {
  return <figure className="my-10 overflow-hidden border border-border bg-bg-raised"><div className="grid gap-px bg-border sm:grid-cols-3"><Panel label="What listings provide" body="Venue · format · showtime · ticket" /><Panel label="What Ithaka models" body="A complete plan for a complete night" tone /><Panel label="What the user receives" body="One pick, one runner-up, receipts on demand" /></div><figcaption className="border-t border-border px-5 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">A cinema is not an option. A showtime plan is.</figcaption></figure>;
}

function Panel({ label, body, tone }: { label: string; body: string; tone?: boolean }) {
  return <div className={`min-h-40 p-5 ${tone ? "bg-[#ddf4f0]" : "bg-bg"}`}><p className="font-mono text-[9px] uppercase tracking-[0.15em] text-gold-bright">{label}</p><p className="mt-8 max-w-[18ch] font-display text-2xl leading-tight text-ink">{body}</p></div>;
}

function ArchitectureVisual() {
  return <figure className="my-10 border border-border bg-bg-raised p-5 sm:p-8"><div className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.1em] sm:grid-cols-5">{["District", "Scraper", "Versioned JSON", "Vercel", "User"].map((item, index) => <div key={item} className="relative border border-border bg-bg p-4 text-center text-ink">{item}{index < 4 && <span className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-gold-bright sm:block">→</span>}</div>)}</div><div className="mt-5 border-l-2 border-sea-bright bg-[#e5f4f1] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.11em] text-sea-bright">When it changes the answer: user → route function → Google Routes</div><div className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-3"><p className="text-sm text-ink-muted"><strong className="text-ink">Static generation</strong><br />Shared data is compiled ahead of a visit.</p><p className="text-sm text-ink-muted"><strong className="text-ink">Serverless function</strong><br />Personal route evidence is computed on demand.</p><p className="text-sm text-ink-muted"><strong className="text-ink">Graceful degradation</strong><br />An honest fallback is better than a fabricated live result.</p></div><figcaption className="mt-5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">Static until the route becomes personal.</figcaption></figure>;
}

function RuleEngineVisual() {
  const rules = [["TIME", "12 PM–1 AM default", "9 AM–12 PM is an explicit edge case"], ["PICTURE", "IMAX earns the journey", "Laser gets up to 30 more outbound minutes"], ["HOME", "Metro or cab", "First-morning service is not a way home"], ["EVIDENCE", "Score every viable plan", "Show the closer strong alternative too"]];
  return <figure className="my-10 overflow-hidden border border-border bg-bg-raised"><div className="grid gap-px bg-border sm:grid-cols-2">{rules.map(([label, rule, receipt]) => <div key={label} className="bg-bg p-5"><p className="font-mono text-[9px] uppercase tracking-[0.15em] text-gold-bright">{label}</p><p className="mt-5 font-display text-xl leading-tight text-ink">{rule}</p><p className="mt-3 text-sm leading-relaxed text-ink-muted">{receipt}</p></div>)}</div><figcaption className="border-t border-border px-5 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">Policies make the machine legible. They are not hidden score multipliers.</figcaption></figure>;
}

function EvidenceVisual() {
  return <figure className="my-10 grid gap-2 border-y border-border py-5 font-mono text-[10px] uppercase tracking-[0.12em] sm:grid-cols-4">{["Answer", "Decisive why", "Counterfactuals", "Full research"].map((item, index) => <div key={item} className={`border p-4 ${index === 0 ? "border-gold text-gold-bright" : "border-border text-ink-muted"}`}><span>{String(index + 1).padStart(2, "0")}</span><span className="mt-6 block text-ink">{item}</span></div>)}</figure>;
}

function ShareRevision() {
  return <figure className="my-10 overflow-hidden border border-border"><div className="grid gap-px bg-border sm:grid-cols-2"><div className="bg-bg p-6"><p className="font-mono text-[9px] uppercase tracking-[0.15em] text-wine-bright">Rejected: the smarter poster</p><p className="mt-5 font-display text-2xl leading-tight">A beautiful receipt.</p><p className="mt-3 text-ink-muted">It proved the answer, but it did not give someone a reason to share it.</p></div><div className="bg-[#e5f4f1] p-6"><p className="font-mono text-[9px] uppercase tracking-[0.15em] text-gold-bright">Kept: the screening declaration</p><p className="mt-5 font-display text-2xl leading-tight">A chosen night.</p><p className="mt-3 text-ink-muted">The person is the subject. Ithaka is the instrument behind it.</p></div></div><figcaption className="border-t border-border bg-bg-raised px-5 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">The share artifact changed when its job changed: from proving the answer to announcing a night.</figcaption></figure>;
}

function ArtVisual() {
  return <figure className="my-10 overflow-hidden border border-border bg-bg-raised"><div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4"><Art image="/result-helmet-tall.jpg" label="Reference direction" /><Art image="/assets/prologue-field-mobile.webp" label="Cinematic exploration" /><Art image="/result-helmet-wide.jpg" label="Desktop result" /><Art image="/result-helmet-tall.jpg" label="Mobile + share" /></div><figcaption className="px-5 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">Reve produced options. Responsive art direction selected the right asset for each job.</figcaption></figure>;
}

function Art({ image, label }: { image: string; label: string }) {
  return <div className="relative aspect-[4/5] overflow-hidden bg-bg"><img src={image} alt="" loading="lazy" className="h-full w-full object-cover opacity-100" /><p className="absolute inset-x-0 bottom-0 bg-white/90 p-3 font-mono text-[8px] uppercase tracking-[0.12em] text-ink">{label}</p></div>;
}

function TechStackVisual() {
  const stack = [["React + TypeScript + Vite", "Fast static decision surface with a typed policy layer."], ["Tailwind + GSAP + canvas", "One visual system, motion only where it earns attention."], ["District + Git JSON", "Structured shared data, versioned and inspectable."], ["Vercel + Google Routes", "One protected server boundary for a personal live call."], ["GitHub Actions + Supabase Cron", "Scrape execution separated from dependable scheduling."], ["Vitest", "Cheap regression checks for policy and time boundaries."]];
  return <figure className="my-10 overflow-hidden border border-border bg-bg-raised"><div className="grid gap-px bg-border sm:grid-cols-2">{stack.map(([tool, reason]) => <div key={tool} className="bg-bg p-5"><p className="font-mono text-[10px] uppercase tracking-[0.11em] text-ink">{tool}</p><p className="mt-3 text-sm leading-relaxed text-ink-muted">{reason}</p></div>)}</div><figcaption className="border-t border-border px-5 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">Every choice answers a constraint; none is there to make the stack look more impressive.</figcaption></figure>;
}

function WorkflowVisual() {
  return <figure className="my-10 border border-border bg-bg-raised p-5 sm:p-8"><div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.11em]">{["Research", "Constraint", "Propose", "Challenge", "Implement", "Verify", "Record"].map((item, index) => <span key={item} className="flex items-center gap-2"><span className={index === 6 ? "border border-gold bg-gold/10 px-3 py-2 text-gold-bright" : "border border-border px-3 py-2 text-ink"}>{item}</span>{index < 6 && <span className="text-gold-bright">→</span>}</span>)}</div><figcaption className="mt-6 font-body italic text-ink-muted">Specialist passes prevent agreement from being mistaken for verification.</figcaption></figure>;
}

function References() {
  return <section className="border-b border-border py-16 sm:py-20"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold-bright">Further reading</p><h2 className="mt-4 font-display text-3xl">Terms and references behind the build</h2><p className="mt-4 max-w-2xl font-body leading-relaxed text-ink-muted">These are implementation concepts that shaped Ithaka—not generic stack badges. They are useful starting points for rebuilding a system with similar boundaries.</p><ul className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2"><Reference href="https://vercel.com/docs/functions" term="Serverless functions" description="Vercel’s model for executing the route boundary only when a request needs it." /><Reference href="https://supabase.com/docs/guides/cron" term="Scheduled jobs" description="Supabase Cron, used when the refresh schedule needed a more dependable owner." /><Reference href="https://docs.github.com/actions" term="Workflow automation" description="GitHub Actions, used to scrape, version, and publish changed shared data." /><Reference href="https://developers.google.com/maps/documentation/routes" term="Route evidence" description="Google Routes, used selectively for the personal leg that can change a recommendation." /><Reference href="https://vitest.dev/guide/" term="Policy tests" description="Vitest, used for time boundaries, format evidence, and recommendation helpers." /><Reference href="https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion" term="Reduced motion" description="The accessibility contract that stops the visual system from being compulsory." /></ul></section>;
}

function Reference({ href, term, description }: { href: string; term: string; description: string }) {
  return <li className="list-none bg-bg p-5"><a href={href} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-2 font-body font-semibold text-ink hover:text-gold-bright">{term} <ArrowUpRight size={14} /></a><p className="mt-2 font-body text-sm leading-relaxed text-ink-muted">{description}</p></li>;
}

function Footer() {
  return <footer className="border-t border-[#26303d] bg-[#090e15] px-5 py-20 text-[#e9e4d8] sm:px-8"><div className="mx-auto max-w-5xl"><div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[#e3c158]"><span className="h-px w-8 bg-[#e3c158]" />What remains unproven</div><h2 className="mt-6 max-w-[18ch] font-display text-[clamp(2.5rem,5vw,4.6rem)] leading-[0.96]">The product still has to earn its place in people’s nights.</h2><p className="mt-8 max-w-2xl font-body text-lg leading-relaxed text-[#aeb8c6]">Will people trust the recommendation without rechecking it? Will they share the declaration? Can the system survive beyond one film and one city? Those are product hypotheses, not retrospective claims.</p><div className="mt-10 flex flex-wrap gap-3"><a href="/" className="bg-[#e3c158] px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#090e15] transition-colors hover:bg-[#f0d37b]">Try Ithaka</a><a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-white/20 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#e9e4d8] transition-colors hover:border-[#e3c158] hover:text-[#e3c158]">View the source <ArrowUpRight size={13} /></a></div><p className="mt-16 border-t border-white/10 pt-5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#7f8b9c]">Ithaka / Delhi NCR / The Odyssey</p></div></footer>;
}
