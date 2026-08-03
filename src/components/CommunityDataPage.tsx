import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, KeyRound, RefreshCw, X } from "lucide-react";

type SignalStatus = "pending" | "approved" | "dismissed";
type SignalImpact = "positive" | "negative" | "mixed" | "neutral";

interface CommunitySignal {
  id: string;
  canonical_url: string;
  subreddit: string;
  title: string;
  excerpt: string;
  published_at: string | null;
  discovered_at: string;
  last_seen_at: string;
  matched_venue_ids: string[];
  signal_categories: string[];
  status: SignalStatus;
  public_summary: string | null;
  public_impact: SignalImpact | null;
  score_adjustment: number;
  applies_to_formats: string[];
  applies_after_local_time: string | null;
  applies_before_local_time: string | null;
  active_from: string | null;
  active_until: string | null;
  reviewed_at: string | null;
  review_notes?: string | null;
}

interface CommunityResponse {
  signals: CommunitySignal[];
  reviewer: boolean;
}

const VENUE_NAMES: Record<string, string> = {
  "priya-vasant-vihar": "PVR Priya",
  "select-citywalk-saket": "PVR Select City Walk",
  "mall-of-india-noida": "PVR Mall of India",
  "vegas-dwarka": "PVR Vegas",
  "ambience-gurugram-kotak-imax": "PVR Ambience Gurugram",
  "inox-paras-nehru-place": "INOX Paras",
  "inox-vishal-mall-rajouri": "INOX Vishal Mall",
  "inox-insignia-epicuria": "INOX Insignia Epicuria",
  "cinepolis-dlf-avenue-saket": "Cinepolis DLF Avenue",
  "devgn-cinex-elan-epic": "Devgn CineX Elan Epic",
  "wave-cinemas-gurugram": "Wave Cinemas Gurugram",
  "directors-cut-mall-of-india-noida": "PVR Director's Cut Noida",
  "inox-pacific-mall-jasola": "INOX Pacific Mall Jasola",
  "pvr-cinemagic-pitampura": "PVR Cinemagic Pitampura",
  "new-us-cinemas-ghaziabad": "New US Cinemas Ghaziabad",
};

function readableVenue(id: string): string {
  return VENUE_NAMES[id] ?? id.replaceAll("-", " ");
}

function displayDate(value: string | null): string {
  if (!value) return "DATE UNAVAILABLE";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function effectLabel(signal: CommunitySignal): string {
  const parts: string[] = [];
  if (signal.score_adjustment) parts.push(`${signal.score_adjustment > 0 ? "+" : ""}${signal.score_adjustment} SCREEN POINTS`);
  if (signal.applies_after_local_time) parts.push(`AFTER ${signal.applies_after_local_time.slice(0, 5)}`);
  if (signal.applies_before_local_time) parts.push(`BEFORE ${signal.applies_before_local_time.slice(0, 5)}`);
  if (signal.active_until) parts.push(`UNTIL ${displayDate(signal.active_until)}`);
  return parts.join(" · ") || "CONTEXT ONLY";
}

export function CommunityDataPage() {
  const [signals, setSignals] = useState<CommunitySignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewToken, setReviewToken] = useState("");
  const [reviewer, setReviewer] = useState(false);

  async function load(token = reviewToken) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/community-data${token ? "?includeDismissed=1" : ""}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(response.status === 401 ? "That review token was not accepted." : "Community data is temporarily unavailable.");
      const payload = (await response.json()) as CommunityResponse;
      setSignals(payload.signals);
      setReviewer(payload.reviewer);
      if (token && payload.reviewer) sessionStorage.setItem("ithaka_community_review_token", token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Community data is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    document.title = "Community data — Ithaka";
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const createdRobots = !robots;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    const previousRobots = robots.content;
    robots.content = "noindex, nofollow";
    const saved = sessionStorage.getItem("ithaka_community_review_token") ?? "";
    if (saved) setReviewToken(saved);
    void load(saved);
    return () => {
      document.title = "Ithaka";
      if (createdRobots) robots?.remove();
      else if (robots) robots.content = previousRobots;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = useMemo(() => signals.filter((signal) => signal.status === "approved"), [signals]);
  const pending = useMemo(() => signals.filter((signal) => signal.status === "pending"), [signals]);
  const dismissed = useMemo(() => signals.filter((signal) => signal.status === "dismissed"), [signals]);

  async function saveReview(signal: CommunitySignal, update: Record<string, unknown>) {
    const response = await fetch("/api/community-data", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${reviewToken}` },
      body: JSON.stringify({ id: signal.id, ...update }),
    });
    if (!response.ok) throw new Error("The review could not be saved.");
    const payload = (await response.json()) as { signal: CommunitySignal };
    setSignals((current) => current.map((item) => item.id === signal.id ? payload.signal : item));
  }

  return (
    <main className="min-h-screen bg-bg text-ink">
      <header className="relative isolate overflow-hidden border-b border-border">
        <img src="/result-helmet-wide.jpg" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30 grayscale" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/95 to-bg/65" />
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-bright">Community intelligence</p>
          <h1 className="mt-4 max-w-[720px] font-display text-[clamp(2.4rem,7vw,5.6rem)] leading-[0.98]">The reports behind the recommendation.</h1>
          <p className="mt-6 max-w-[650px] font-body text-[1.08rem] leading-relaxed text-ink-muted sm:text-[1.25rem]">
            A public record of recent community reports we are checking, what has been accepted, and exactly when it changes Ithaka&rsquo;s judgement.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-5 py-12 sm:px-8 sm:py-16">
        {error && <div className="mb-8 border border-wine/50 bg-wine/10 p-4 font-body text-wine">{error}</div>}
        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-muted"><RefreshCw size={14} className="animate-spin" /> Checking the community record</div>
        ) : (
          <>
            <CommunitySection number="01" title="Active signals" description="Reviewed reports that currently inform the recommendation." empty="No community reports are affecting recommendations right now.">
              {active.map((signal) => <SignalCard key={signal.id} signal={signal} active reviewer={reviewer} onSave={saveReview} />)}
            </CommunitySection>

            <CommunitySection number="02" title="Under review" description="Leads found by the daily search. These do not affect a recommendation until a human approves them." empty="The review inbox is clear.">
              {pending.map((signal) => <SignalCard key={signal.id} signal={signal} reviewer={reviewer} onSave={saveReview} />)}
            </CommunitySection>

            {reviewer && dismissed.length > 0 && (
              <CommunitySection number="03" title="Dismissed" description="Kept for deduplication and audit, but never used by Ithaka." empty="No dismissed leads.">
                {dismissed.map((signal) => <SignalCard key={signal.id} signal={signal} reviewer onSave={saveReview} />)}
              </CommunitySection>
            )}

            <section className="py-14 sm:py-20">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-bright">{reviewer ? "04" : "03"} / Methodology</p>
              <h2 className="mt-4 font-display text-[clamp(2rem,5vw,3.8rem)] leading-tight">Discovery is automatic. Trust is not.</h2>
              <div className="mt-8 grid gap-8 border-t border-border pt-8 font-body text-[1.02rem] leading-relaxed text-ink-muted md:grid-cols-3">
                <MethodStep label="Discover" text="Once a day, tightly scoped Exa searches check eight approved subreddits for the 15 cinemas Ithaka actually compares." />
                <MethodStep label="Verify" text="New links enter this inbox as unverified leads. A human checks recency, venue identity, specificity and whether another report corroborates the claim." />
                <MethodStep label="Apply" text="Only approved, time-bounded adjustments can change a screen score. Expired reports remain visible but stop influencing the result." />
              </div>
            </section>
          </>
        )}

        <section className="border-t border-border py-10">
          <details className="max-w-[620px]">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted"><KeyRound size={14} /> Founder review access</summary>
            <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void load(reviewToken); }}>
              <input type="password" value={reviewToken} onChange={(event) => setReviewToken(event.target.value)} autoComplete="off" placeholder="Review token" className="min-h-[46px] flex-1 border border-border bg-bg-raised px-4 font-mono text-[12px] text-ink outline-none focus:border-gold" />
              <button type="submit" className="min-h-[46px] border border-gold px-6 font-mono text-[10px] uppercase tracking-[0.14em] text-gold-bright">Enter review mode</button>
            </form>
          </details>
        </section>
      </div>
    </main>
  );
}

function CommunitySection({ number, title, description, empty, children }: { number: string; title: string; description: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some(Boolean);
  return (
    <section className="border-b border-border py-14 first:pt-0 sm:py-20">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-bright">{number}</p>
      <div className="mt-4 max-w-[760px]"><h2 className="font-display text-[clamp(2rem,5vw,3.8rem)] leading-tight">{title}</h2><p className="mt-3 font-body text-[1.05rem] leading-relaxed text-ink-muted sm:text-[1.18rem]">{description}</p></div>
      <div className="mt-8 grid gap-4">{hasItems ? children : <p className="border border-border bg-bg-raised p-6 font-body text-ink-muted">{empty}</p>}</div>
    </section>
  );
}

function SignalCard({ signal, active = false, reviewer, onSave }: { signal: CommunitySignal; active?: boolean; reviewer: boolean; onSave: (signal: CommunitySignal, update: Record<string, unknown>) => Promise<void> }) {
  const [summary, setSummary] = useState(signal.public_summary ?? "");
  const [adjustment, setAdjustment] = useState(signal.score_adjustment ?? 0);
  const [after, setAfter] = useState(signal.applies_after_local_time?.slice(0, 5) ?? "");
  const [formats, setFormats] = useState(signal.applies_to_formats.join(", "));
  const [until, setUntil] = useState(signal.active_until ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(status: SignalStatus) {
    setSaving(true); setError(null);
    try {
      await onSave(signal, { status, publicSummary: summary, publicImpact: adjustment < 0 ? "negative" : adjustment > 0 ? "positive" : "neutral", scoreAdjustment: adjustment, appliesToFormats: formats.split(",").map((item) => item.trim()).filter(Boolean), ...(after ? { appliesAfterLocalTime: after } : {}), ...(until ? { activeUntil: until } : {}) });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save review."); }
    finally { setSaving(false); }
  }

  return (
    <article className={`border bg-bg-raised p-5 sm:p-7 ${active ? "border-gold/55" : "border-border"}`}>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.13em] text-ink-muted">
        <span className={active ? "text-gold-bright" : "text-sea-bright"}>{active ? "ACTIVE" : signal.status === "pending" ? "UNVERIFIED" : "DISMISSED"}</span><span>·</span><span>r/{signal.subreddit}</span><span>·</span><span>{displayDate(signal.published_at ?? signal.discovered_at)}</span>
      </div>
      <h3 className="mt-4 font-body text-[1.28rem] font-semibold leading-snug text-ink sm:text-[1.5rem]">{signal.public_summary || signal.title}</h3>
      {!active && <p className="mt-3 max-w-[900px] font-body text-[1rem] leading-relaxed text-ink-muted">{signal.excerpt}</p>}
      <div className="mt-5 flex flex-wrap gap-2">{signal.matched_venue_ids.map((venue) => <span key={venue} className="border border-border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-muted">{readableVenue(venue)}</span>)}</div>
      {active && <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.13em] text-gold-bright">{effectLabel(signal)}</p>}
      <a href={signal.canonical_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-[44px] items-center gap-2 font-mono text-[10px] uppercase tracking-[0.13em] text-sea-bright">Read the source <ExternalLink size={13} /></a>

      {reviewer && (
        <div className="mt-6 border-t border-border pt-6">
          <label className="block font-mono text-[9px] uppercase tracking-[0.13em] text-ink-muted">Public conclusion<textarea value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={1200} className="mt-2 min-h-[88px] w-full border border-border bg-bg px-3 py-2 font-body text-[15px] normal-case tracking-normal text-ink outline-none focus:border-gold" /></label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">Screen adjustment<input type="number" min={-30} max={20} value={adjustment} onChange={(event) => setAdjustment(Number(event.target.value))} className="mt-2 min-h-[42px] w-full border border-border bg-bg px-3 text-ink" /></label>
            <label className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">Applies after<input type="time" value={after} onChange={(event) => setAfter(event.target.value)} className="mt-2 min-h-[42px] w-full border border-border bg-bg px-3 text-ink" /></label>
            <label className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">Active until<input type="date" value={until} onChange={(event) => setUntil(event.target.value)} className="mt-2 min-h-[42px] w-full border border-border bg-bg px-3 text-ink" /></label>
            <label className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">Exact formats<input type="text" value={formats} onChange={(event) => setFormats(event.target.value)} placeholder="IMAX 2D, PXL 2D" className="mt-2 min-h-[42px] w-full border border-border bg-bg px-3 text-ink normal-case tracking-normal" /></label>
          </div>
          {error && <p className="mt-3 font-body text-wine">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            {signal.status !== "approved" && <button type="button" disabled={saving || !summary.trim()} onClick={() => void act("approved")} className="inline-flex min-h-[44px] items-center gap-2 border border-gold px-4 font-mono text-[9px] uppercase tracking-[0.12em] text-gold-bright disabled:opacity-40"><Check size={13} /> Approve</button>}
            {signal.status !== "dismissed" && <button type="button" disabled={saving} onClick={() => void act("dismissed")} className="inline-flex min-h-[44px] items-center gap-2 border border-border px-4 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted disabled:opacity-40"><X size={13} /> Dismiss</button>}
            {signal.status !== "pending" && <button type="button" disabled={saving} onClick={() => void act("pending")} className="min-h-[44px] px-4 font-mono text-[9px] uppercase tracking-[0.12em] text-sea-bright">Return to review</button>}
          </div>
        </div>
      )}
    </article>
  );
}

function MethodStep({ label, text }: { label: string; text: string }) {
  return <div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-sea-bright">{label}</p><p className="mt-3">{text}</p></div>;
}

export default CommunityDataPage;
