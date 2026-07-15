import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { StatisticsPage } from "./StatisticsPage.tsx";
import { CardPage } from "./CardPage.tsx";
import { DecksPage } from "./DecksPage.tsx";
import { DeckPage } from "./DeckPage.tsx";
import { ArchetypesPage } from "./ArchetypesPage.tsx";
import { ArchetypePage } from "./ArchetypePage.tsx";
import { TournamentsPage } from "./TournamentsPage.tsx";
import { TournamentPage } from "./TournamentPage.tsx";
import { RoundTimerPage } from "./RoundTimerPage.tsx";
import { CompetitorsPage } from "./CompetitorsPage.tsx";
import { CompetitorPage } from "./CompetitorPage.tsx";
import { RandomDeckPage } from "./RandomDeckPage.tsx";
import { HomePage } from "./HomePage.tsx";
import { MatchupsPage } from "./MatchupsPage.tsx";
import { MetagamePage } from "./MetagamePage.tsx";
import { CasualMetagamePage } from "./CasualMetagamePage.tsx";
import { MatchesPage } from "./MatchesPage.tsx";
import { CasualPlayersPage } from "./CasualPlayersPage.tsx";
import { CasualPlayerPage } from "./CasualPlayerPage.tsx";
import { ManaTrackerPage } from "./ManaTrackerPage.tsx";
import { Layout } from "./Layout.tsx";
import { KeepAlive } from "./KeepAlive.tsx";
import "./index.css";

// QueryClient holds the cache for all server data fetched via TanStack Query.
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <KeepAlive />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/random-deck" element={<RandomDeckPage />} />
            <Route path="/matchups" element={<MatchupsPage />} />
            <Route path="/archetypes" element={<ArchetypesPage />} />
            <Route path="/archetypes/:name" element={<ArchetypePage />} />
            <Route path="/cards" element={<StatisticsPage />} />
            <Route path="/cards/:name" element={<CardPage />} />
            <Route path="/decks" element={<DecksPage />} />
            <Route path="/decks/:id" element={<DeckPage />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/tournaments/metagame" element={<MetagamePage />} />
            <Route path="/tournaments/:id" element={<TournamentPage />} />
            <Route path="/tournaments/players" element={<CompetitorsPage />} />
            <Route path="/tournaments/players/:id" element={<CompetitorPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/matches/metagame" element={<CasualMetagamePage />} />
            <Route path="/matches/players" element={<CasualPlayersPage />} />
            <Route path="/matches/players/:id" element={<CasualPlayerPage />} />
            <Route path="/tools/mana-tracker" element={<ManaTrackerPage />} />
          </Route>
          <Route path="/tournaments/:id/round/:roundNumber" element={<RoundTimerPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
