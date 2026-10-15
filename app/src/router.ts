// Hash routing. The static host serves one index.html, so the route lives after
// '#'. Two pages: a run replay and the architecture explainer.

import { useEffect, useState } from "react";

export type Route =
  | { page: "run"; bundle: string | null; t: number | null }
  | { page: "architecture" };

export function parse(hash: string): Route {
  const [path, query] = hash.replace(/^#\/?/, "").split("?");
  const [head, arg] = path.split("/");
  if (head === "architecture") return { page: "architecture" };
  const t = new URLSearchParams(query ?? "").get("t");
  return {
    page: "run",
    bundle: head === "run" && arg ? decodeURIComponent(arg) : null,
    t: t !== null && Number.isFinite(Number(t)) ? Number(t) : null,
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

export const runHref = (bundle: string, t?: number) =>
  `#/run/${encodeURIComponent(bundle)}${t !== undefined ? `?t=${t.toFixed(2)}` : ""}`;
export const ARCH_HREF = "#/architecture";
