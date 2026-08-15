import Link from "next/link";
import GameAtlasMark from "./gameatlas-mark";

interface SiteHeaderProps {
  active?: "browse";
}

export default function SiteHeader({ active }: SiteHeaderProps) {
  const browseClassName = `topnav-link${active === "browse" ? " topnav-link--active" : ""}`;

  return (
    <header className="topbar">
      <Link className="wordmark" href="/" aria-label="GameAtlas home">
        <GameAtlasMark />
        <span>Game<span className="wordmark-accent">Atlas</span></span>
      </Link>
      <nav className="topnav" aria-label="Primary navigation">
        <Link className={browseClassName} href="/#games" aria-current={active === "browse" ? "page" : undefined}>Browse</Link>
        <Link className="topnav-link topnav-link--optional" href="/#platforms">Collections</Link>
        <Link className="topnav-link" href="/#method">About</Link>
        <Link className="topnav-link topnav-link--optional" href="/docs/rights-and-support-policy/">Sources</Link>
      </nav>
      <div className="topbar-tools">
        <Link className="topbar-tool topbar-search" href="/#games" aria-label="Search the catalog">
          <span aria-hidden="true">⌕</span>
        </Link>
        <span className="topbar-avatar" aria-label="GameAtlas editorial" role="img">A</span>
      </div>
    </header>
  );
}
