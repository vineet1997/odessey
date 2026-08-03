import { useState } from "react";
import { Check } from "lucide-react";
import { submitFeedback, trackEvent, type FeedbackSentiment } from "../lib/telemetry";

interface FeedbackPromptProps {
  context: {
    venue: string;
    format: string;
    intent: string;
  };
}

const OPTIONS: Array<{ value: FeedbackSentiment; label: string }> = [
  { value: "helpful", label: "Yes, useful" },
  { value: "almost", label: "Almost" },
  { value: "missed", label: "Not really" },
];

export function FeedbackPrompt({ context }: FeedbackPromptProps) {
  const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(null);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(next: FeedbackSentiment) {
    setSentiment(next);
    setError(null);
    trackEvent("feedback_started", { sentiment: next });
  }

  async function send() {
    if (!sentiment || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitFeedback(sentiment, message, context);
      setSubmitted(true);
    } catch {
      setError("That didn’t reach Ithaka. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="border-t border-border py-9 sm:py-11" aria-labelledby="feedback-heading">
      <p id="feedback-heading" className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-muted">A small favour</p>
      {submitted ? (
        <p className="mt-3 flex items-center gap-2 font-body text-[1rem] italic text-ink"><Check size={16} className="text-gold-bright" /> Thank you. This is exactly the kind of signal I&rsquo;m building Ithaka around.</p>
      ) : (
        <>
          <p className="mt-3 max-w-[44rem] font-body text-[1rem] leading-relaxed text-ink">Did this make choosing a screen less annoying? I&rsquo;d genuinely like to know where the plan missed.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => choose(option.value)}
                aria-pressed={sentiment === option.value}
                className={`min-h-10 border px-3 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${sentiment === option.value ? "border-gold bg-gold/10 text-gold-bright" : "border-border text-ink-muted hover:border-ink/30 hover:text-ink"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {sentiment && (
            <div className="mt-4 max-w-[38rem]">
              <label htmlFor="ithaka-feedback" className="font-mono text-[10px] uppercase tracking-[0.11em] text-ink-muted">Optional note</label>
              <textarea id="ithaka-feedback" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1200} rows={3} placeholder="What would have made this answer better?" className="mt-2 block w-full resize-y border border-border bg-transparent px-3 py-2.5 font-body text-sm text-ink placeholder:text-ink-muted focus:border-gold focus:outline-none" />
              <button type="button" onClick={send} disabled={sending} className="mt-3 min-h-10 border border-gold px-4 font-mono text-[10px] uppercase tracking-[0.11em] text-gold-bright transition-colors hover:bg-gold hover:text-bg disabled:cursor-wait disabled:opacity-60">{sending ? "Sending…" : "Send thought"}</button>
              {error && <p className="mt-3 font-body text-sm text-wine-bright" role="alert">{error}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
