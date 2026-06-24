import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "./BackLink";
import { Loading } from "./QueryState";
import { RecordTable } from "./RecordTable";
import { pct, archetypeLabel } from "./format";
import { fetchCasualPlayer } from "./api";

export function CasualPlayerPage() {
  const id = Number(useParams().id);
  const { data, isLoading } = useQuery({ queryKey: ["casual-player", id], queryFn: () => fetchCasualPlayer(id) });

  return (
    <main className="page">
      <BackLink />
      {isLoading && <Loading />}
      {data && (
        <>
          <h1 style={{ marginBottom: "0.25rem" }}>{data.name}</h1>
          <p style={{ color: "#555", margin: "0 0 1rem" }}>
            {data.matches} match{data.matches === 1 ? "" : "es"} · {data.wins}-{data.losses}-{data.draws} ·{" "}
            {pct(data.matchWinPct)} match win · {pct(data.gameWinPct)} game win
          </p>

          <RecordTable
            heading="Archetypes played"
            firstCol="Archetype"
            rows={data.archetypesPlayed.map((a) => ({ key: archetypeLabel(a), label: archetypeLabel(a), wins: a.wins, losses: a.losses, draws: a.draws }))}
          />

          <RecordTable
            heading="Record vs player"
            firstCol="Opponent"
            rows={data.vsPlayers.map((o) => ({
              key: o.opponentId != null ? `p${o.opponentId}` : o.opponentName,
              label: o.opponentId != null ? <Link to={`/matches/players/${o.opponentId}`}>{o.opponentName}</Link> : o.opponentName,
              wins: o.wins,
              losses: o.losses,
              draws: o.draws,
            }))}
          />

          <RecordTable
            heading="Record vs archetype"
            firstCol="Opponent archetype"
            rows={data.vsArchetypes.map((a) => ({ key: archetypeLabel(a), label: archetypeLabel(a), wins: a.wins, losses: a.losses, draws: a.draws }))}
          />

          {data.recentMatches.length > 0 && (
            <>
              <h2 style={{ margin: "1.5rem 0 0.5rem" }}>Recent matches</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {data.recentMatches.map((m) => {
                  const meP1 = m.player1Id === id;
                  const myWins = meP1 ? m.player1Wins : m.player2Wins;
                  const oppWins = meP1 ? m.player2Wins : m.player1Wins;
                  const oppId = meP1 ? m.player2Id : m.player1Id;
                  const oppName = meP1 ? m.player2Name : m.player1Name;
                  const result = myWins > oppWins ? "W" : myWins < oppWins ? "L" : "D";
                  return (
                    <div key={m.id} style={{ fontSize: "0.9rem" }}>
                      <strong style={{ color: result === "W" ? "#16a34a" : result === "L" ? "#dc2626" : "#999" }}>{result}</strong>{" "}
                      {myWins}-{oppWins}
                      {m.draws ? `-${m.draws}` : ""} vs <Link to={`/matches/players/${oppId}`}>{oppName}</Link>
                      {m.date && <span style={{ color: "#999" }}> · {m.date}</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
