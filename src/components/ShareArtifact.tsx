import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { ShareArtifactModel } from "../lib/shareArtifact";

const RETURN_COLORS = {
  live: "#83c5be",
  "no-route": "#b97070",
  unverified: "#d2b56d",
} as const;

/** A fixed-pixel canvas. It is intentionally not responsive: the surrounding
 * composer scales it for preview and html-to-image captures this exact object. */
export const ShareArtifact = forwardRef<HTMLDivElement, { model: ShareArtifactModel }>(function ShareArtifact({ model }, ref) {
  const returnColor = RETURN_COLORS[model.returnStatus];
  const venueTitleSize =
    model.venueName.length > 38
      ? "max-w-[12ch] text-[46px]"
      : model.venueName.length > 25
        ? "text-[54px]"
        : "text-[68px]";
  return (
    <article
      ref={ref}
      aria-label="Ithaka share image"
      data-testid="share-artifact"
      className="relative isolate overflow-hidden bg-[#070b10] text-[#efe9dc]"
      style={{ width: 1080, height: 1350, fontFamily: "var(--font-body, Georgia, serif)" }}
    >
      <img
        src="/result-helmet-tall.jpg"
        alt=""
        crossOrigin="anonymous"
        className="absolute inset-y-0 right-0 h-full w-[69%] object-cover object-[59%_46%] opacity-[0.9]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#070b10_0%,rgba(7,11,16,0.91)_36%,rgba(7,11,16,0.18)_78%,rgba(7,11,16,0.54)_100%)]" />
      <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(rgba(239,233,220,0.8)_0.65px,transparent_0.8px)] [background-size:5px_5px]" />

      <div className="absolute left-12 top-12 h-7 w-7 border-l border-t border-[#b58a45]" />
      <div className="absolute right-12 top-12 h-7 w-7 border-r border-t border-[#b58a45]" />
      <div className="absolute bottom-12 left-12 h-7 w-7 border-b border-l border-[#b58a45]" />
      <div className="absolute bottom-12 right-12 h-7 w-7 border-b border-r border-[#b58a45]" />

      <header className="absolute left-[76px] right-[76px] top-[72px] flex items-start justify-between border-b border-[#b58a45]/80 pb-5">
        <div>
          <p className="font-display text-[31px] tracking-[0.22em]">ITHAKA</p>
          <p className="mt-2 font-mono text-[13px] uppercase tracking-[0.22em] text-[#b9b5aa]">Personal night brief</p>
        </div>
        <p className="mt-2 max-w-[230px] text-right font-mono text-[12px] uppercase leading-relaxed tracking-[0.15em] text-[#b9b5aa]">
          {model.region} · {model.date}
        </p>
      </header>

      <section className="absolute left-[76px] top-[220px] w-[570px]">
        <p className="font-mono text-[15px] uppercase tracking-[0.2em] text-[#e8bd62]">{model.intent}</p>
        <h1 className={`mt-5 max-w-[11ch] font-display leading-[0.98] tracking-[-0.025em] [text-wrap:balance] ${venueTitleSize}`}>{model.venueName}</h1>
        <div className="mt-6 flex items-baseline gap-4 font-mono uppercase">
          <span className="text-[22px] tracking-[0.1em] text-[#e8bd62]">{model.format}</span>
          <span className="text-[43px] tracking-[-0.04em]">{model.showtime}</span>
        </div>
        <p className="mt-2 font-mono text-[14px] uppercase tracking-[0.16em] text-[#b9b5aa]">{model.seatClass} · {model.price}</p>
      </section>

      <section className="absolute left-[76px] top-[548px] w-[560px] border-l-2 pl-5" style={{ borderColor: returnColor }}>
        <p className="font-mono text-[13px] uppercase tracking-[0.18em]" style={{ color: returnColor }}>Journey home</p>
        <p className="mt-3 font-display text-[27px] leading-[1.1] tracking-[0.02em]">{model.returnHeadline}</p>
      </section>

      <Chronospine model={model} color={returnColor} />

      <section className="absolute bottom-[238px] left-[76px] w-[625px]">
        <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#e8bd62]">The decision</p>
        <p className="mt-3 font-body text-[28px] italic leading-[1.25] text-[#efe9dc]">{model.decisionLead}</p>
        <p className="mt-5 font-mono text-[16px] uppercase leading-[1.55] tracking-[0.08em] text-[#b9b5aa]">{model.comparisonReceipt}</p>
      </section>

      <footer className="absolute bottom-[72px] left-[76px] right-[76px] flex items-end justify-between border-t border-[#b58a45]/80 pt-5">
        <div>
          <p className="font-mono text-[14px] uppercase tracking-[0.13em] text-[#b9b5aa]">{model.provenance}</p>
          <p className="mt-3 font-display text-[26px] tracking-[0.16em] text-[#e8bd62]">ONE ANSWER.</p>
          <p className="mt-4 font-mono text-[15px] uppercase tracking-[0.14em]">FIND YOUR SCREEN</p>
          <p className="mt-1 font-mono text-[12px] tracking-[0.07em] text-[#b9b5aa]">{model.publicUrl.replace(/^https?:\/\//, "")}</p>
        </div>
        <div className="bg-[#efe9dc] p-2">
          <QRCodeSVG value={model.publicUrl} size={118} level="M" marginSize={4} bgColor="#efe9dc" fgColor="#070b10" />
        </div>
      </footer>
    </article>
  );
});

function Chronospine({ model, color }: { model: ShareArtifactModel; color: string }) {
  const ys = [662, 723, 784, 845, 906];
  return (
    <section className="absolute left-[76px] top-[634px] h-[300px] w-[910px]" aria-label="Evening timeline">
      <svg viewBox="0 0 910 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M724 14 C696 72 752 100 723 145 C694 191 750 220 722 286" fill="none" stroke="#c18f48" strokeWidth="2" opacity="0.86" />
        {ys.map((y, index) => (
          <g key={model.timeline[index].label}>
            <path d={`M332 ${y - 634} H${676 + (index % 2) * 18}`} fill="none" stroke="#b9b5aa" strokeWidth="1" opacity="0.52" />
            <circle cx={724} cy={y - 634} r={index === 2 ? 9 : 6} fill="#070b10" stroke={index === 4 ? color : "#c18f48"} strokeWidth={index === 2 ? 3 : 2} />
          </g>
        ))}
      </svg>
      <ol className="relative space-y-[21px]">
        {model.timeline.map((moment, index) => (
          <li key={moment.label} className="grid grid-cols-[112px_170px] items-baseline gap-4">
            <span className="font-mono text-[13px] uppercase tracking-[0.16em] text-[#b9b5aa]">{moment.label}</span>
            <span className={`font-mono text-[24px] tracking-[-0.02em] ${index === 2 ? "text-[#e8bd62]" : "text-[#efe9dc]"}`}>{moment.time.toUpperCase()}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
