import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "./site-footer";
import SiteHeader from "./site-header";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This GameAtlas page does not exist.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <div className="site-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <SiteHeader />
    <main className="policy-page" id="main-content"><p className="eyebrow">404 · unmapped route</p><h1>That trail ends here.</h1><p className="policy-intro">The page you requested is not in the atlas yet.</p><Link className="text-link" href="/">Return to GameAtlas <span aria-hidden="true">↗</span></Link></main>
    <SiteFooter />
  </div>;
}
