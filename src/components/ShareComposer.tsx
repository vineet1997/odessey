import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Loader2, Share2, X } from "lucide-react";
import type { ShareArtifactModel } from "../lib/shareArtifact";
import { downloadShareArtifact, exportShareArtifact } from "../lib/exportShareArtifact";
import { ShareArtifact } from "./ShareArtifact";

interface ShareComposerProps {
  model: ShareArtifactModel;
  onClose: () => void;
}

export function ShareComposer({ model, onClose }: ShareComposerProps) {
  const artifactRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const [blob, setBlob] = useState<Blob>();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousBodyOverflow;
      restoreFocus.current?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | undefined;
    const generate = async () => {
      if (!artifactRef.current) return;
      try {
        setState("loading");
        const nextBlob = await exportShareArtifact(artifactRef.current);
        if (disposed) return;
        objectUrl = URL.createObjectURL(nextBlob);
        setBlob(nextBlob);
        setPreviewUrl(objectUrl);
        setState("ready");
      } catch (reason) {
        if (disposed) return;
        setError(reason instanceof Error ? reason.message : "Could not generate the image.");
        setState("error");
      }
    };
    void generate();
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [model]);

  async function shareOrDownload() {
    if (!blob) return;
    const file = new File([blob], model.filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Ithaka", text: model.caption });
        return;
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("The share sheet could not open. Download the image instead.");
      }
    }
    downloadShareArtifact(blob, model.filename);
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(model.caption);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy is unavailable here. You can still download the image.");
    }
  }

  const canNativeShare = Boolean(blob && navigator.canShare?.({ files: [new File([blob], model.filename, { type: "image/png" })] }));
  const fileSizeLabel = blob ? `${(blob.size / (1024 * 1024)).toFixed(1)} MB` : undefined;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="share-brief-title" className="relative max-h-[96vh] w-full max-w-[980px] overflow-y-auto border border-border bg-bg px-5 pb-6 pt-5 shadow-2xl sm:rounded-sm sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.19em] text-gold-bright">Made to travel</p>
            <h2 id="share-brief-title" className="mt-1 font-display text-2xl text-ink">Share your night brief</h2>
            <p className="mt-2 max-w-[60ch] font-body text-sm leading-relaxed text-ink-muted">Your exact starting point and route are never included. The image only uses the broad region, screening facts and research receipt.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center border border-border text-ink-muted" aria-label="Close share brief"><X size={18} /></button>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px] md:items-start">
          <div className="relative overflow-hidden border border-border bg-[#070b10]">
            {previewUrl ? (
              <img src={previewUrl} alt="Generated Ithaka night brief" className="block h-auto w-full" />
            ) : (
              <div className="relative aspect-[4/5] overflow-hidden">
                <div className="absolute left-1/2 top-0 origin-top -translate-x-1/2 scale-[0.38] sm:scale-[0.5]">
                  <ShareArtifact model={model} />
                </div>
                <div className="absolute inset-0 grid place-items-center bg-bg/25"><span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink"><Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> Preparing image</span></div>
              </div>
            )}
            {/* Export source stays at native pixels. The preview is deliberately
                separate so a PNG never captures a CSS-scaled card. */}
            <div className="absolute -left-[2000px] top-0" aria-hidden="true"><ShareArtifact ref={artifactRef} model={model} /></div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-muted">1080 × 1350 PNG{fileSizeLabel ? ` · ${fileSizeLabel}` : ""} · Ready for feeds, messages and posts</p>
            {state === "loading" && <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted"><Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> Rendering the final image</p>}
            {state === "error" && <p className="border-l-2 border-wine pl-3 font-body text-sm italic text-wine-bright">{error}</p>}
            <button type="button" disabled={state !== "ready" || !blob} onClick={() => void shareOrDownload()} className="flex min-h-12 items-center justify-center gap-2 bg-gold px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-bg disabled:cursor-wait disabled:opacity-50">
              {canNativeShare ? <Share2 size={16} /> : <Download size={16} />}{canNativeShare ? "Share image" : "Download image"}
            </button>
            <button type="button" onClick={() => void copyCaption()} className="flex min-h-12 items-center justify-center gap-2 border border-border px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-gold-bright">
              {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy caption + link"}
            </button>
            <p className="pt-2 font-body text-xs italic leading-relaxed text-ink-muted">One answer, with enough evidence to be useful. No booking controls or personal route data are baked into the image.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
