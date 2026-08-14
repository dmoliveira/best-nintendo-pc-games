import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This GameAtlas page does not exist.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <main className="policy-page"><p className="eyebrow">404 · unmapped route</p><h1>That trail ends here.</h1><p className="policy-intro">The page you requested is not in the atlas yet.</p><Link className="text-link" href="/">Return to GameAtlas ↗</Link></main>;
}
