import type { IntentId } from "../../scoring/score";

export type Day = "weekday" | "weekend";
export type TimeBand = "matinee" | "evening" | "night";

/** The four answers collected by the Helm, one per screen. */
export interface HelmAnswers {
  locality: string;
  day: Day;
  timeBand: TimeBand;
  intentId: IntentId;
}

/** Direction of the most recent step change — drives which way the deck slides. */
export type StepDirection = "forward" | "back";
