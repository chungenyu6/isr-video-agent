// Hash routing. The static host serves one index.html, so the route lives after
// '#' and a shared link to a run opens that run. This site has exactly one page
// -- a run -- so every other hash falls back to "no bundle chosen yet".

import { useEffect, useState } from "react";

export type Route = { page: "run"; bundle: string | null };

export function parse(hash: string): Route {
  const [head, arg] = hash.replace(/^#\/?/, "").split("/");
  if (head === "run") return { page: "run", bundle: arg ? decodeURIComponent(arg) : null };
  return { page: "run", bundle: null };
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

export const runHref = (bundle: string) => `#/run/${encodeURIComponent(bundle)}`;
