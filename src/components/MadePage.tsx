import { useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { PrologueField } from "./PrologueField";

const sourceUrl = "https://github.com/vineet1997/odessey";

/** A public engineering article, deliberately lighter than the product itself.
 * It explains decisions with evidence instead of turning the build record into
 * a portfolio timeline. */
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
  return <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><a href="/" className="font-display text-lg tracking-[0.14em]">ITHAKA</a><a href="/" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-gold-bright">Find your screen <ArrowLeft size={13} className="rotate-180" /></a></div></header>;
}

function Hero() {
  return <section className="border-b border-border bg-bg"><div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"><div><p className="font-mono text-[11px] font-medium uppercase text-gold-bright">Engineering note · 8 minute read</p><h1 className="mt-6 max-w-[12ch] font-display text-[clamp(3rem,7vw,6rem)] leading-[0.94]">How I built a cinema decision engine for one film.</h1><p className="mt-7 max-w-[38rem] font-body text-[clamp(1.1rem,2vw,1.35rem)] leading-relaxed text-ink">Ithaka turns live showtimes, screen formats, travel constraints, and the journey home into one recommendation for <em>The Odyssey</em> in Delhi NCR.</p><p className="mt-6 max-w-[38rem] font-body leading-relaxed text-ink-muted">This is not a claim that the product has found product-market fit. It is a record of the product and engineering decisions used to make one answer worth defending.</p></div><figure className="relative h-[320px] overflow-hidden rounded-sm bg-[#132c2d] shadow-sm sm:h-[430px]" aria-label="Interactive image collage from Ithaka's entrance"><PrologueField contained /><div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-[linear-gradient(transparent,rgba(7,16,20,0.75))] px-5 pb-5 pt-14"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/85">The entrance field · move across the image</p></div></figure></div></section>;
}

function Article() {
  return <article className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
    <Intro />
    <Section number="01" title="The problem was not finding cinemas">
      <p>When I started looking for a place to watch <em>The Odyssey</em>, every cinema site could list shows. None could answer the actual question: <em>which show is worth taking once picture quality, ticket price, travel time, and getting home are all true at once?</em></p>
      <p>The first product decision followed from that: Ithaka would not be a better directory. It would make a recommendation.</p>
      <DecisionVisual />
      <Aside title="The model">The unit of choice is not a cinema. It is a <strong>venue × format × showtime</strong>—a complete plan for a complete night.</Aside>
      <p>That sounds subtle, but it changes everything. “PVR Priya” is not one option if its 6:30 AM IMAX show, a later standard show, and a competing venue’s same-time IMAX show create different costs and different journeys home.</p>
    </Section>

    <Section number="02" title="Static by default, live where reality is personal">
      <p>Showtimes are shared information. Your travel time is not. Treating both as equally live would make the app more expensive, more fragile, and harder to inspect without making the recommendation meaningfully better.</p>
      <ArchitectureVisual />
      <p>District was the right source for this narrow release because its pages exposed structured session data. BookMyShow was more bot-protected, redundant for the scope, and would have made the system less dependable. The scraper writes versioned showtime data; Vercel serves the static app; a server-side route function makes the only truly personal call.</p>
      <Aside title="Why not a normal backend?">A backend is not a badge of seriousness. Most of Ithaka is a newspaper delivered on a schedule. It only makes a live call when a person’s route can change the answer.</Aside>
      <Evolution />
    </Section>

    <Section number="03" title="The hardest bugs were believable">
      <p className="font-display text-[clamp(1.8rem,4vw,3.1rem)] leading-[1.05] text-ink">Nothing crashed. The answer was still wrong.</p>
      <p>A showtime parser returned a valid time, the UI rendered it, and the recommendation pipeline completed. But the time-zone assumption was wrong. A flagship IMAX could appear to start before dawn; the resulting film-end time and journey-home advice were wrong too.</p>
      <TimezoneVisual />
      <p>The repair was not merely a conversion function. It changed the verification standard: compare parsed data with the rendered source, test the recommendation boundary, and let uncertainty remain visible. “Transit unverified” is more useful than a confident fiction.</p>
      <Aside title="The product test">A system can satisfy its code while failing its user. Human plausibility is part of the debugging system.</Aside>
    </Section>

    <Section number="04" title="Trust is a hierarchy, not a data dump">
      <p>A recommendation with no explanation feels arbitrary. An explanation with every fact in the first viewport feels like homework. Ithaka uses progressive evidence: the answer first, the decisive comparison next, then counterfactuals and the full ledger for someone who wants to audit it.</p>
      <EvidenceVisual />
      <p>This is also why format claims are bounded. An IMAX label is not enough to invent projector, sound, or seating claims. The app only makes a stronger statement when the underlying evidence is venue-specific.</p>
      <ShareRevision />
    </Section>

    <Section number="05" title="Cinematic design had to earn its runtime cost">
      <p>The visual direction began with a simple problem: the input flow should feel like setting out on an expedition, but the result page should help someone make a decision. Those are different jobs, and they should not share the same level of spectacle.</p>
      <ArtVisual />
      <p>Reve generated options. Art direction chose the useful ones: a wide helmet composition for desktop, a portrait take for mobile and sharing, and a quieter treatment once the user reached the recommendation. Particle motion creates atmosphere at the entrance; it yields to touch, readability, reduced-motion preferences, and device limits.</p>
      <Aside title="The design rule">Cinematic continuity does not mean repeating the same effect. It means each surface belongs to the same world while doing its own job.</Aside>
    </Section>

    <Section number="06" title="The first version is allowed to be wrong">
      <p>The visible product is not the result of one clean plan. It is the result of changing direction when the work revealed a better question.</p>
      <RevisionTable />
      <p>The share-artifact revision mattered most. The first version was smart: it showed the recommendation, timeline, receipt, and research provenance. It was also socially wrong. A person does not share an exported audit trail to make their night feel like an event.</p>
    </Section>

    <Section number="07" title="A studio workflow, not a magic prompt">
      <p>Claude and Codex were part of the build, but neither is the story on its own. The useful workflow was separating roles: use one pass to propose, another to challenge, another to implement, then independently verify the result in tests and a browser.</p>
      <WorkflowVisual />
      <p>Reve handled visual exploration. Vercel handled deployment and the route function. Supabase Cron took over scheduled refreshes. Codex handled implementation, code review, test runs, browser QA, and the living build record. The human work remained scope, taste, factual standards, and deciding when a result was actually done.</p>
      <Aside title="The durable lesson">AI made construction faster. It did not decide what could be trusted, what should be cut, or whether the product was finished.</Aside>
    </Section>
    <References />
  </article>;
}

function Intro() { return <div className="grid gap-7 border-b border-border py-16 sm:py-20 lg:grid-cols-[0.8fr_1.2fr]"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-bright">The short version</p><div className="font-body text-[1.2rem] leading-relaxed text-ink/90"><p>Ithaka was deliberately built for one film, one region, and one theatrical window. That constraint made the architecture sharper: static data where possible, live evidence only where it changed a recommendation, and a product that says what it does not know.</p><p className="mt-5 text-ink-muted">The rest of this article explains the decisions, revisions, and visual system behind that choice.</p></div></div>; }

function Section({ number, title, children }: { number: string; title: string; children: ReactNode }) { return <section className="grid gap-7 border-b border-border py-16 sm:py-24 lg:grid-cols-[0.27fr_minmax(0,0.73fr)] lg:gap-14"><div><p className="font-mono text-[10px] tracking-[0.18em] text-gold-bright">{number}</p><h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.3rem)] leading-[0.95] tracking-[-0.03em]">{title}</h2></div><div className="space-y-6 font-body text-[1.08rem] leading-[1.7] text-ink/85">{children}</div></section>; }
function Aside({ title, children }: { title: string; children: ReactNode }) { return <aside className="my-10 border-l-2 border-gold bg-gold/[0.045] px-5 py-5"><p className="font-mono text-[9px] uppercase tracking-[0.17em] text-gold-bright">{title}</p><p className="mt-3 font-body text-[1.05rem] leading-relaxed text-ink">{children}</p></aside>; }

function DecisionVisual() { return <figure className="my-10 overflow-hidden border border-border bg-bg-raised"><div className="grid gap-px bg-border sm:grid-cols-3"><Panel label="What listings provide" body="Venue · format · showtime · ticket" /><Panel label="What Ithaka models" body="A complete plan for a complete night" tone /><Panel label="What the user receives" body="One pick, one runner-up, receipts on demand" /></div><figcaption className="border-t border-border px-5 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">A cinema is not an option. A showtime plan is.</figcaption></figure>; }
function Panel({ label, body, tone }: { label: string; body: string; tone?: boolean }) { return <div className={`min-h-40 p-5 ${tone ? "bg-[#ddf4f0]" : "bg-bg"}`}><p className="font-mono text-[9px] uppercase tracking-[0.15em] text-gold-bright">{label}</p><p className="mt-8 max-w-[18ch] font-display text-2xl leading-tight text-ink">{body}</p></div>; }

function ArchitectureVisual() { return <figure className="my-10 border border-border bg-bg-raised p-5 sm:p-8"><div className="grid gap-2 font-mono text-[10px] uppercase tracking-[0.1em] sm:grid-cols-5">{["District", "Scraper", "Versioned JSON", "Vercel", "User"].map((item, index) => <div key={item} className="relative border border-border bg-bg p-4 text-center text-ink">{item}{index < 4 && <span className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-gold-bright sm:block">→</span>}</div>)}</div><div className="mt-5 border-l-2 border-sea-bright bg-[#e5f4f1] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.11em] text-sea-bright">When it changes the answer: user → route function → Google Routes</div><div className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-3"><p className="text-sm text-ink-muted"><strong className="text-ink">Static generation</strong><br />Shared data is compiled ahead of a visit.</p><p className="text-sm text-ink-muted"><strong className="text-ink">Serverless function</strong><br />Personal route evidence is computed on demand.</p><p className="text-sm text-ink-muted"><strong className="text-ink">Graceful degradation</strong><br />An honest fallback is better than a fabricated live result.</p></div><figcaption className="mt-5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">Static until the route becomes personal.</figcaption></figure>; }
function Evolution() { return <div className="my-10 border-y border-border py-5"><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-gold-bright">What changed in production</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr]"><p className="font-body text-ink-muted">GitHub Actions cron<br /><span className="text-sm">First refresh loop</span></p><p className="hidden text-gold-bright sm:block">→</p><p className="font-body text-ink">Supabase Cron<br /><span className="text-sm text-ink-muted">Timing reliability mattered more than tool loyalty.</span></p></div></div>; }

function TimezoneVisual() { return <figure className="my-10 overflow-hidden border border-border bg-bg-raised"><div className="grid gap-px bg-border sm:grid-cols-4">{["Raw source time", "Wrong timezone assumption", "Wrong film end", "Wrong journey-home claim"].map((item, index) => <div key={item} className={`min-h-32 p-4 ${index === 3 ? "bg-wine/20" : "bg-bg"}`}><p className="font-mono text-[9px] text-gold-bright">{String(index + 1).padStart(2, "0")}</p><p className="mt-7 font-display text-xl leading-tight">{item}</p></div>)}</div><figcaption className="px-5 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">A correct-looking value can create an incorrect recommendation.</figcaption></figure>; }
function EvidenceVisual() { return <figure className="my-10 grid gap-2 border-y border-border py-5 font-mono text-[10px] uppercase tracking-[0.12em] sm:grid-cols-4">{["Answer", "Decisive why", "Counterfactuals", "Full research"].map((item, index) => <div key={item} className={`border p-4 ${index === 0 ? "border-gold text-gold-bright" : "border-border text-ink-muted"}`}><span>{String(index + 1).padStart(2, "0")}</span><span className="mt-6 block text-ink">{item}</span></div>)}</figure>; }
function ShareRevision() { return <figure className="my-10 overflow-hidden border border-border"><div className="grid gap-px bg-border sm:grid-cols-2"><div className="bg-bg p-6"><p className="font-mono text-[9px] uppercase tracking-[0.15em] text-wine-bright">Rejected: the smarter poster</p><p className="mt-5 font-display text-2xl leading-tight">A beautiful receipt.</p><p className="mt-3 text-ink-muted">It proved the answer, but it did not give someone a reason to share it.</p></div><div className="bg-[#e5f4f1] p-6"><p className="font-mono text-[9px] uppercase tracking-[0.15em] text-gold-bright">Kept: the screening declaration</p><p className="mt-5 font-display text-2xl leading-tight">A chosen night.</p><p className="mt-3 text-ink-muted">The person is the subject. Ithaka is the instrument behind it.</p></div></div><figcaption className="border-t border-border bg-bg-raised px-5 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">The share artifact changed when its job changed: from proving the answer to announcing a night.</figcaption></figure>; }

function ArtVisual() { return <figure className="my-10 overflow-hidden border border-border bg-bg-raised"><div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4"><Art image="/result-helmet-tall.jpg" label="Reference direction" /><Art image="/assets/prologue-field-mobile.webp" label="Cinematic exploration" /><Art image="/result-helmet-wide.jpg" label="Desktop result" /><Art image="/result-helmet-tall.jpg" label="Mobile + share" /></div><figcaption className="px-5 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">Reve produced options. Responsive art direction selected the right asset for each job.</figcaption></figure>; }
function Art({ image, label }: { image: string; label: string }) { return <div className="relative aspect-[4/5] overflow-hidden bg-bg"><img src={image} alt="" loading="lazy" className="h-full w-full object-cover opacity-100" /><p className="absolute inset-x-0 bottom-0 bg-white/90 p-3 font-mono text-[8px] uppercase tracking-[0.12em] text-ink">{label}</p></div>; }

function RevisionTable() { const rows = [["GitHub Actions refresh", "Scheduled timing was not dependable enough", "Supabase Cron"], ["Evidence-heavy share card", "Intelligent, but socially wrong", "Screening Declaration"], ["One visual treatment", "Mobile paid for desktop spectacle", "Responsive art direction"]]; return <div className="my-10 overflow-x-auto border border-border"><table className="w-full min-w-[620px] border-collapse text-left"><thead className="bg-bg-raised font-mono text-[9px] uppercase tracking-[0.13em] text-gold-bright"><tr><th className="p-4 font-normal">First approach</th><th className="p-4 font-normal">What it revealed</th><th className="p-4 font-normal">Revision</th></tr></thead><tbody>{rows.map(([a,b,c]) => <tr key={a} className="border-t border-border align-top"><td className="p-4 font-body text-ink">{a}</td><td className="p-4 text-ink-muted">{b}</td><td className="p-4 font-body text-ink">{c}</td></tr>)}</tbody></table></div>; }
function WorkflowVisual() { return <figure className="my-10 border border-border bg-bg-raised p-5 sm:p-8"><div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.11em]">{["Research", "Constraint", "Propose", "Challenge", "Implement", "Verify", "Record"].map((item, index) => <span key={item} className="flex items-center gap-2"><span className={index === 6 ? "border border-gold bg-gold/10 px-3 py-2 text-gold-bright" : "border border-border px-3 py-2 text-ink"}>{item}</span>{index < 6 && <span className="text-gold-bright">→</span>}</span>)}</div><figcaption className="mt-6 font-body italic text-ink-muted">Specialist passes prevent agreement from being mistaken for verification.</figcaption></figure>; }

function References() { return <section className="border-b border-border py-16 sm:py-20"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold-bright">Further reading</p><h2 className="mt-4 font-display text-3xl">Terms and references behind the build</h2><p className="mt-4 max-w-2xl font-body leading-relaxed text-ink-muted">These are the implementation concepts that shaped Ithaka—not generic stack badges. They are useful starting points for rebuilding a system with similar boundaries.</p><ul className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2"><Reference href="https://vercel.com/docs/functions" term="Serverless functions" description="Vercel’s model for executing the route boundary only when a request needs it." /><Reference href="https://supabase.com/docs/guides/cron" term="Scheduled jobs" description="Supabase Cron, used when the refresh schedule needed a more dependable owner." /><Reference href="https://developers.google.com/maps/documentation/routes" term="Route evidence" description="Google Routes, used selectively for the personal leg that can change a recommendation." /><Reference href="https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion" term="Reduced motion" description="The accessibility contract that stops the visual system from being compulsory." /></ul></section>; }
function Reference({ href, term, description }: { href: string; term: string; description: string }) { return <li className="list-none bg-bg p-5"><a href={href} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-2 font-body font-semibold text-ink hover:text-gold-bright">{term} <ArrowUpRight size={14} /></a><p className="mt-2 font-body text-sm leading-relaxed text-ink-muted">{description}</p></li>; }

function Footer() { return <footer className="border-t border-border bg-bg-raised px-5 py-20 sm:px-8"><div className="mx-auto max-w-5xl"><p className="font-mono text-[10px] uppercase text-gold-bright">What remains unproven</p><h2 className="mt-5 max-w-[18ch] font-display text-[clamp(2.5rem,5vw,4.6rem)] leading-[0.96]">The product still has to earn its place in people&rsquo;s nights.</h2><p className="mt-8 max-w-2xl font-body text-lg leading-relaxed text-ink-muted">Will people trust the recommendation without rechecking it? Will they share the declaration? Can the system survive beyond one film and one city? Those are product hypotheses, not retrospective claims.</p><div className="mt-10 flex flex-wrap gap-3"><a href="/" className="bg-gold px-5 py-3 font-mono text-[10px] font-medium uppercase text-white">Try Ithaka</a><a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-border bg-bg px-5 py-3 font-mono text-[10px] uppercase text-ink">View the source <ArrowUpRight size={13} /></a></div></div></footer>; }
