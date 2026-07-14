import { Link } from "react-router-dom";
import { IconAffiliate, IconChartPie } from "@tabler/icons-react";

const LINKS = [
  { to: "/tournaments/metagame", icon: IconChartPie, label: "Tournament metagame", description: "What's being played in recorded events" },
  { to: "/matches/metagame", icon: IconChartPie, label: "Casual metagame", description: "What's being played in casual matches" },
  { to: "/archetypes", icon: IconAffiliate, label: "Archetypes", description: "Browse the format's deck archetypes" },
];

export function HomePage() {
  return (
    <main className="page home-page">
      <div className="home-hero">
        <h1>Welcome to pauper.info</h1>
        <p className="page-subtitle">
          A side project by Sam to build tools for the Pauper format of Magic: The Gathering.
        </p>
      </div>

      <div className="home-links">
        {LINKS.map(({ to, icon: Icon, label, description }) => (
          <Link key={to} to={to} className="home-link-card">
            <Icon size={22} stroke={1.75} />
            <div>
              <div className="home-link-title">{label}</div>
              <div className="home-link-description">{description}</div>
            </div>
          </Link>
        ))}
      </div>

      <p className="home-footnote">
        Run into an issue or have a feature request?{" "}
        <a href="https://github.com/Selliott452/pauper_info/issues" target="_blank" rel="noreferrer">
          Let me know
        </a>
        .
      </p>
    </main>
  );
}
