// Shapes shared by the architecture diagrams. Each version supplies its own
// content (v42/content.ts, v50/content.ts); the components only draw it.

export type Zone = "agent" | "host" | "models";

export interface ZoneInfo { name: string; note: string; idle?: boolean }

export interface Component {
  id: string;
  zone: Zone;
  name: string;
  sub: string;
  role: string;
  facts: string[];
  /** implemented but not exercised in the measured batch */
  idle?: boolean;
}

export interface Participant { id: string; name: string; sub: string; idle?: boolean }

export interface SeqMsg {
  from: string;
  to: string;
  label: string;
  detail: string;
  highlight: string[];
  /** V4.2: index into the featured bundle's steps; the replay link jumps to its result */
  step?: number;
  /** V5.0: pipeline stage on the replay */
  stage?: number;
  dashed?: boolean;
  /** an optional branch that did not run */
  skipped?: boolean;
}

export interface FlowStage {
  lane: "host" | "model" | "agent" | "after";
  name: string;
  what: string;
  payload: string;
}
