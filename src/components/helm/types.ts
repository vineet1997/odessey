import type { IntentId } from "../../scoring/score";

export type WhenChoice = "tonight" | "tomorrow" | "weekend";

export interface Origin {
  /** Display label — a curated locality name, or "Your location". */
  label: string;
  lat: number;
  lng: number;
  /** Region for display; undefined when the origin came from geolocation. */
  region?: string;
}

/** The three answers collected by the Helm, one per screen. */
export interface HelmAnswers {
  origin: Origin;
  when: WhenChoice;
  intentId: IntentId;
}

/** Direction of the most recent step change — drives which way the deck slides. */
export type StepDirection = "forward" | "back";
