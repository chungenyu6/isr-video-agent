// Hash routing. The static host serves one index.html, so the route lives after
// '#'. Pages: a run replay (either version, chosen by the bundle name), a V5.3
// diagnostic case replay, and the architecture explainer (V5.3 by default,
// V4.2 kept).

import { useEffect, useState } from "react";
import type { VersionKey } from "./types";

export type Route =
  | { page: "run"; bundle: string | null; t: number | null; stage: number | null }
  | { page: "case"; bundle: string | null; stage: number | null }
  | { page: "architecture"; version: VersionKey };

const num = (v: string | null) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

export function parse(hash: string): Route {
  // A second "#" is an in-page anchor (for example #/architecture#agent-value).
  const [path, query] = hash.replace(/^#\/?/, "").split("#")[0].split("?");
  const [head, arg] = path.split("/");
  if (head === "architecture") return { page: "architecture", version: arg === "v4.2" ? "v42" : "v53" };
  const q = new URLSearchParams(query ?? "");
  if (head === "case") return { page: "case", bundle: arg ? decodeURIComponent(arg) : null, stage: num(q.get("stage")) };
  return {
    page: "run",
    bundle: head === "run" && arg ? decodeURIComponent(arg) : null,
    t: num(q.get("t")),
    stage: num(q.get("stage")),
  };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

/** The version a bundle belongs to, from its name; null for anything else. */
export const versionOf = (bundle: string): VersionKey | null =>
  bundle.startsWith("v53-") ? "v53" : bundle.startsWith("v42-") ? "v42" : null;

/** V5.0 and V5.2 left the site with V5.3 (same clips, same main pipeline): their run links land
 *  on the V5.3 run of that clip, and V5.2 diagnostic links on the V5.3 replay of that scenario. */
export const upgradeLink = (bundle: string) =>
  bundle.replace(/^v5[02]-diag-(B\d)-pi$/, "v53-diag-$1-pi-cap2").replace(/^v5[02]-/, "v53-");

export const runHref = (bundle: string, t?: number) =>
  `#/run/${encodeURIComponent(bundle)}${t !== undefined ? `?t=${t.toFixed(2)}` : ""}`;
export const stageHref = (bundle: string, stage: number) =>
  `#/run/${encodeURIComponent(bundle)}?stage=${stage}`;
export const caseHref = (bundle: string, stage?: number) =>
  `#/case/${encodeURIComponent(bundle)}${stage !== undefined ? `?stage=${stage}` : ""}`;
export const archHref = (v: VersionKey = "v53") => (v === "v42" ? "#/architecture/v4.2" : "#/architecture");
export const ARCH_HREF = archHref("v53");
