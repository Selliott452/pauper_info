import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BackLink } from "./BackLink";
import { Empty, ErrorText, Loading } from "./QueryState";
import { fetchTournaments } from "./api";

// QR-code landing target: resolves to whatever's currently happening without
// anyone having to know a tournament id. `fetchTournaments` is already sorted
// most-recent-first, so the first entry is "the" tournament; its `currentRound`
// sends us straight to the round timer players already use on their phones.
// Falls back to the tournament page itself if no round has started yet.
export function LatestTournamentPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({ queryKey: ["tournaments"], queryFn: fetchTournaments });

  const latest = data?.[0];

  useEffect(() => {
    if (!latest) return;
    const target = latest.currentRound > 0 ? `/tournaments/${latest.id}/round/${latest.currentRound}` : `/tournaments/${latest.id}`;
    navigate(target, { replace: true });
  }, [latest, navigate]);

  return (
    <main className="page">
      <BackLink />
      {isLoading && <Loading />}
      {isError && <ErrorText message="Couldn't load tournaments." />}
      {!isLoading && !isError && !latest && <Empty>No tournaments yet.</Empty>}
    </main>
  );
}
