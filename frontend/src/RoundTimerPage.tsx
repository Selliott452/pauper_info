import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchTournament, type PlayerStanding, type RoundView } from "./api";
import { Loading } from "./QueryState";

// A read-only, full-screen view of a single round's timer and pairings, intended
// for players to keep open on their phone while playing. It polls the tournament
// on the same 3s interval as the organizer's view so the timer stays in sync -
// including pauses and resets made on the organizer's device.
export function RoundTimerPage() {
  const id = Number(useParams().id);
  const roundNumber = Number(useParams().roundNumber);

  const { data, isLoading } = useQuery({
    queryKey: ["tournament", id],
    queryFn: () => fetchTournament(id),
    refetchInterval: 3000,
  });

  const [tab, setTab] = useState<"pairings" | "standings">("pairings");

  if (isLoading) {
    return (
      <main className="round-timer-page">
        <Loading />
      </main>
    );
  }

  const round = data?.roundViews.find((r) => r.number === roundNumber);

  if (!data || !round) {
    return (
      <main className="round-timer-page">
        <p>Round not found.</p>
        <Link to={`/tournaments/${id}`}>Back to tournament</Link>
      </main>
    );
  }

  // Rounds are navigable in order; arrows are disabled at the ends.
  const numbers = data.roundViews.map((r) => r.number).sort((a, b) => a - b);
  const prev = numbers.filter((n) => n < round.number).pop();
  const next = numbers.find((n) => n > round.number);

  return (
    <main className="round-timer-page">
      <div className="round-timer-header">
        <Link to={`/tournaments/${id}`} className="round-timer-back">
          ← Tournament
        </Link>
        <div className="round-timer-nav">
          {prev != null ? (
            <Link to={`/tournaments/${id}/round/${prev}`} className="round-timer-arrow" aria-label="Previous round">
              ‹
            </Link>
          ) : (
            <span className="round-timer-arrow disabled">‹</span>
          )}
          <span className="round-timer-round">Round {round.number}</span>
          {next != null ? (
            <Link to={`/tournaments/${id}/round/${next}`} className="round-timer-arrow" aria-label="Next round">
              ›
            </Link>
          ) : (
            <span className="round-timer-arrow disabled">›</span>
          )}
        </div>
      </div>

      <BigTimer round={round} roundMinutes={data.roundMinutes} />

      <div className="round-timer-tabs">
        <button
          className={`pill ${tab === "pairings" ? "active" : ""}`}
          onClick={() => setTab("pairings")}
        >
          Pairings
        </button>
        <button
          className={`pill ${tab === "standings" ? "active" : ""}`}
          onClick={() => setTab("standings")}
        >
          Standings
        </button>
      </div>

      {tab === "pairings" ? (
        <div className="round-timer-pairings">
          {[...round.matches]
            .sort((a, b) => Number(a.bye) - Number(b.bye))
            .map((m) => (
              <div key={m.matchId} className="round-timer-pairing">
                {m.bye ? (
                  <span>
                    <strong>{m.player1Name}</strong> — bye
                  </span>
                ) : (
                  <span>
                    <strong>{m.player1Name}</strong> vs <strong>{m.player2Name}</strong>
                  </span>
                )}
              </div>
            ))}
        </div>
      ) : (
        <Standings standings={data.standings} />
      )}
    </main>
  );
}

// Compact leaderboard for the player view: rank, name, points and record only.
function Standings({ standings }: { standings: PlayerStanding[] }) {
  return (
    <table className="round-timer-standings">
      <thead>
        <tr>
          <th>#</th>
          <th style={{ textAlign: "left" }}>Player</th>
          <th>Pts</th>
          <th>Record</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s) => (
          <tr key={s.playerId} style={{ opacity: s.dropped ? 0.5 : 1 }}>
            <td>{s.rank}</td>
            <td style={{ textAlign: "left" }}>
              {s.name}
              {s.dropped && <span className="round-timer-dropped"> (dropped)</span>}
            </td>
            <td style={{ fontWeight: 600 }}>{s.matchPoints}</td>
            <td>
              {s.wins}-{s.losses}-{s.draws}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Large countdown. Server state is the source of truth: while running the round
// carries timerEndsAt (a wall-clock instant) and we tick locally toward it;
// while paused it carries timerRemainingSeconds (a frozen value).
function BigTimer({ round, roundMinutes }: { round: RoundView; roundMinutes: number | null }) {
  const running = round.timerEndsAt != null;
  const paused = round.timerRemainingSeconds != null;

  // Re-render every second while running so the countdown advances.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  let seconds: number;
  if (running) seconds = Math.max(0, Math.round((Date.parse(round.timerEndsAt!) - Date.now()) / 1000));
  else if (paused) seconds = round.timerRemainingSeconds!;
  else seconds = (roundMinutes ?? 0) * 60;

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const expired = running && seconds === 0;

  const status = expired ? "Time!" : paused ? "Paused" : running ? "Running" : "Not started";
  const stateClass = expired ? "expired" : paused ? "paused" : running ? "running" : "idle";

  return (
    <div className={`round-timer-clock ${stateClass}`}>
      <div className="round-timer-time">{expired ? "Time!" : `${mm}:${ss}`}</div>
      <div className="round-timer-status">{status}</div>
    </div>
  );
}
