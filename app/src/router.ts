// Hash routing. The static host serves one index.html, so the route lives after
// '#'. Two pages: a run replay (either version, chosen by the bundle name) and
// the architecture explainer (V5.0 by default, V4.2 kept).

import { useEffect, useState } from "react";
import type { VersionKey } from "./types";

export type Route =
  | { page: "run"; bundle: string | null; t: number | null; stage: number | null }
  | { page: "architecture"; version: VersionKey };

const num = (v: string | null) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

export function parse(hash: string): Route {
  const [path, query] = hash.replace(/^#\/?/, "").split("?");
  const [head, arg] = path.split("/");
  if (head === "architecture") return { page: "architecture", version: arg === "v4.2" ? "v42" : "v50" };
  const q = new URLSearchParams(query ?? "");
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
  bundle.startsWith("v50-") ? "v50" : bundle.startsWith("v42-") ? "v42" : null;

export const runHref = (bundle: string, t?: number) =>
  `#/run/${encodeURIComponent(bundle)}${t !== undefined ? `?t=${t.toFixed(2)}` : ""}`;
export const stageHref = (bundle: string, stage: number) =>
  `#/run/${encodeURIComponent(bundle)}?stage=${stage}`;
export const archHref = (v: VersionKey = "v50") => (v === "v42" ? "#/architecture/v4.2" : "#/architecture");
export const ARCH_HREF = archHref("v50");
