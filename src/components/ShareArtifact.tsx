import { forwardRef } from "react";
import type { ShareArtifactModel } from "../lib/shareArtifact";

/** Fixed-pixel primary share: a personal film-poster cover, not an app card. */
export const ShareArtifact = forwardRef<HTMLDivElement, { model: ShareArtifactModel }>(function ShareArtifact({ model }, ref) {
  const venueSize = model.venueName.length > 35 ? "text-[36px]" : model.venueName.length > 24 ? "text-[43px]" : "text-[51px]";
  const showRegion = model.region.length <= 15;
  return (
    <article
      ref={ref}
      aria-label="Ithaka Screening Declaration"
      data-testid="share-artifact"
      className="relative isolate overflow-hidden bg-[#070b10] text-[#f1eadc]"
      style={{ width: 1080, height: 1350, fontFamily: "var(--font-body, Georgia, serif)" }}
    >
      <img
        src="/result-helmet-tall.jpg"
        alt=""
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-cover object-[63%_45%] brightness-110 saturate-[0.9]"
      />
      {/* A real negative field for type; the helmet remains bright/protagonist on the right. */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,8,12,0.98)_0%,rgba(5,8,12,0.94)_34%,rgba(5,8,12,0.43)_60%,rgba(5,8,12,0.04)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,12,0.15)_0%,transparent_43%,rgba(5,8,12,0.9)_76%,#05080c_100%)]" />
      <div className="absolute inset-0 opacity-[0.075] [background-image:radial-gradient(rgba(241,234,220,0.9)_0.55px,transparent_0.75px)] [background-size:5px_5px]" />

      <section className="absolute left-[82px] top-[105px] w-[575px]">
        <p className="font-mono text-[15px] uppercase tracking-[0.24em] text-[#e8bd62]">MY ODYSSEY PLAN</p>
        <h1 className="mt-8 font-display text-[100px] leading-[0.84] tracking-[-0.05em]">THE<br />ODYSSEY</h1>
        <p className="mt-9 font-mono text-[16px] uppercase tracking-[0.21em] text-[#d1c6b3]">THIS IS MY ONE.</p>
      </section>

      <section className="absolute bottom-[123px] left-[82px] right-[82px] border-t border-[#b58a45]/80 pt-8">
        <div className="flex items-end gap-7">
          <p className="font-mono text-[17px] uppercase tracking-[0.18em] text-[#d1c6b3]">{model.date}</p>
          <p className="font-mono text-[70px] leading-none tracking-[-0.06em] text-[#f1eadc]">{model.showtime}</p>
        </div>
        <p className="mt-6 font-mono text-[19px] uppercase tracking-[0.16em] text-[#e8bd62]">{model.format}</p>
        <h2 className={`mt-3 max-w-[18ch] font-display leading-[1.02] tracking-[-0.02em] ${venueSize}`}>{model.venueName}</h2>
        <div className="mt-7 flex items-baseline justify-between font-mono uppercase">
          <p className="text-[14px] tracking-[0.2em] text-[#d1c6b3]">FOUND WITH ITHAKA</p>
          {showRegion && <p className="text-[12px] tracking-[0.16em] text-[#a9a093]">{model.region}</p>}
        </div>
      </section>
    </article>
  );
});
