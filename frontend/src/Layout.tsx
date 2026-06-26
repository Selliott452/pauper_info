import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { IconAffiliate, IconArrowsShuffle, IconCards, IconChartPie, IconLayoutGrid, IconMenu2, IconScale, IconSwords, IconTrophy, IconUsers, IconX } from "@tabler/icons-react";

function navClass(active: boolean): string {
  return active ? "nav-item active" : "nav-item";
}

// App shell with a persistent left sidebar. On narrow viewports the sidebar
// becomes a top bar and the nav collapses behind a hamburger toggle.
export function Layout() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const onArchetypes = pathname.startsWith("/archetypes");
  const onCards = pathname.startsWith("/cards");
  const onDecks = pathname.startsWith("/decks");
  const onRandom = pathname === "/";
  const onMatchups = pathname.startsWith("/matchups");
  const onMetagame = pathname === "/tournaments/metagame";
  const onTournaments = pathname.startsWith("/tournaments") && !onMetagame;
  const onPlayers = pathname.startsWith("/players");
  const onCasualPlayers = pathname.startsWith("/matches/players");
  const onCasualMetagame = pathname === "/matches/metagame";
  const onMatches = pathname === "/matches";

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand" onClick={closeMenu}>
            pauper.info
          </Link>
          <button
            className="nav-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <IconX size={22} stroke={2} /> : <IconMenu2 size={22} stroke={2} />}
          </button>
        </div>

        <div className={`nav-links ${menuOpen ? "open" : ""}`} onClick={closeMenu}>
          <div className="nav-group-label">Discover</div>
          <Link to="/" className={navClass(onRandom)}>
            <IconArrowsShuffle size={18} stroke={2} />
            Random deck
          </Link>
          <Link to="/matchups" className={navClass(onMatchups)}>
            <IconScale size={18} stroke={2} />
            Matchups
          </Link>

          <div className="nav-group-label">Tournaments</div>
          <Link to="/tournaments" className={navClass(onTournaments)}>
            <IconTrophy size={18} stroke={2} />
            Tournaments
          </Link>
          <Link to="/tournaments/metagame" className={navClass(onMetagame)}>
            <IconChartPie size={18} stroke={2} />
            Metagame
          </Link>
          <Link to="/players" className={navClass(onPlayers)}>
            <IconUsers size={18} stroke={2} />
            Players
          </Link>

          <div className="nav-group-label">Casual</div>
          <Link to="/matches" className={navClass(onMatches)}>
            <IconSwords size={18} stroke={2} />
            Matches
          </Link>
          <Link to="/matches/metagame" className={navClass(onCasualMetagame)}>
            <IconChartPie size={18} stroke={2} />
            Metagame
          </Link>
          <Link to="/matches/players" className={navClass(onCasualPlayers)}>
            <IconUsers size={18} stroke={2} />
            Players
          </Link>

          <div className="nav-group-label">Metagame</div>
          <Link to="/archetypes" className={navClass(onArchetypes)}>
            <IconAffiliate size={18} stroke={2} />
            Archetypes
          </Link>
          <Link to="/cards" className={navClass(onCards)}>
            <IconCards size={18} stroke={2} />
            Cards
          </Link>
          <Link to="/decks" className={navClass(onDecks)}>
            <IconLayoutGrid size={18} stroke={2} />
            Decks
          </Link>
        </div>
      </nav>
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  );
}
