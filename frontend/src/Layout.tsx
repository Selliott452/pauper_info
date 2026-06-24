import { Link, Outlet, useLocation } from "react-router-dom";
import { IconAffiliate, IconArrowsShuffle, IconCards, IconLayoutGrid, IconScale, IconSwords, IconTrophy, IconUsers } from "@tabler/icons-react";

function navClass(active: boolean): string {
  return active ? "nav-item active" : "nav-item";
}

// App shell with a persistent left sidebar. The nav is split into two independent
// groups: the metagame stats pages and the (separate) tournament manager.
export function Layout() {
  const { pathname } = useLocation();
  const onArchetypes = pathname === "/" || pathname.startsWith("/archetypes");
  const onCards = pathname.startsWith("/cards");
  const onDecks = pathname.startsWith("/decks");
  const onRandom = pathname.startsWith("/random");
  const onMatchups = pathname.startsWith("/matchups");
  const onTournaments = pathname.startsWith("/tournaments");
  const onPlayers = pathname.startsWith("/players");
  const onCasualPlayers = pathname.startsWith("/matches/players");
  const onMatches = pathname === "/matches";

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <Link to="/" className="sidebar-brand">
          pauper.info
        </Link>

        <div className="nav-group-label">Discover</div>
        <Link to="/random" className={navClass(onRandom)}>
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
        <Link to="/players" className={navClass(onPlayers)}>
          <IconUsers size={18} stroke={2} />
          Players
        </Link>

        <div className="nav-group-label">Casual</div>
        <Link to="/matches" className={navClass(onMatches)}>
          <IconSwords size={18} stroke={2} />
          Matches
        </Link>
        <Link to="/matches/players" className={navClass(onCasualPlayers)}>
          <IconUsers size={18} stroke={2} />
          Players
        </Link>

        <div className="nav-group-label">Metagame</div>
        <Link to="/" className={navClass(onArchetypes)}>
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
      </nav>
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  );
}
