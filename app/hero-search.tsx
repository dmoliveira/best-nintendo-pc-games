"use client";

import { useEffect, useState } from "react";
import { SEARCH_STATE_EVENT } from "@/lib/catalog/search";

function cleanQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export default function HeroSearch() {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const syncFromUrl = () => setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener(SEARCH_STATE_EVENT, syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener(SEARCH_STATE_EVENT, syncFromUrl);
    };
  }, []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(window.location.search);
    const nextQuery = cleanQuery(query);
    if (nextQuery) params.set("q", nextQuery);
    else params.delete("q");
    params.delete("page");
    const serialized = params.toString();
    const nextUrl = `${window.location.pathname}${serialized ? `?${serialized}` : ""}#games`;
    window.history.pushState({}, "", nextUrl);
    window.dispatchEvent(new Event("popstate"));
    document.getElementById("games")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <form className="hero-search" role="search" aria-label="Quick catalog search" onSubmit={submit}>
      <label className="sr-only" htmlFor="hero-query">Search games, platforms, genres, or people</label>
      <span className="field-icon" aria-hidden="true">⌕</span>
      <input id="hero-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by game, platform, genre or mood" />
      <button type="submit" aria-label="Search catalog"><span aria-hidden="true">↗</span><span className="sr-only">Search</span></button>
    </form>
  );
}
