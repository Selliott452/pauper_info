import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "./BackLink";
import { Loading } from "./QueryState";
import { RecordTable } from "./RecordTable";
import { pct, archetypeLabel } from "./format";
import { fetchCompetitor, type OpponentRecord } from "./api";

export function CompetitorPage() {
  const id = Number(useParams().id);
  const { data, isLoading } = useQuery({ queryKey: ["competitor", id], queryFn: () => fetchCompetitor(id) });

  return (
    <main className="page">
      <BackLink />

      {isLoading && <Loading />}
      {data && (
        <>
          <h1 style={{ marginBottom: "0.25rem" }}>{data.name}</h1>
          <p style={{ color: "#555", margin: "0 0 1.5rem" }}>
            {data.events} event{data.events === 1 ? "" : "s"} · {data.wins}-{data.losses}-{data.draws} ·{" "}
            {pct(data.matchWinPct)} match win · {pct(data.gameWinPct)} game win
          </p>

          <h2 style={{ marginBottom: "0.5rem" }}>Tournament history</h2>
          {data.results.length === 0 ? (
            <p style={{ color: "#666" }}>Hasn't played in any tournaments yet.</p>
          ) : (
            <table className="data-table" style={{ maxWidth: 640 }}>
              <thead>
                <tr>
                  <th>Tournament</th>
                  <th className="center">Finish</th>
                  <th className="center">Record</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((r) => (
                  <tr key={r.eventId}>
                    <td>
                      <Link to={`/tournaments/${r.eventId}`}>{r.eventName}</Link>
                    </td>
                    <td className="center">
                      {r.rank} / {r.players}
                    </td>
                    <td className="center">
                      {r.wins}-{r.losses}-{r.draws}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <RecordTable
            heading="Archetypes played"
            firstCol="Archetype"
            rows={data.archetypesPlayed.map((a) => ({
              key: archetypeLabel(a),
              label: archetypeLabel(a),
              wins: a.wins,
              losses: a.losses,
              draws: a.draws,
            }))}
          />

          <RecordTable
            heading="Record vs player"
            firstCol="Opponent"
            rows={data.vsPlayers.map((o: OpponentRecord) => ({
              key: o.opponentId != null ? `c${o.opponentId}` : o.opponentName,
              label: o.opponentId != null ? <Link to={`/players/${o.opponentId}`}>{o.opponentName}</Link> : o.opponentName,
              wins: o.wins,
              losses: o.losses,
              draws: o.draws,
            }))}
          />

          <RecordTable
            heading="Record vs archetype"
            firstCol="Opponent archetype"
            rows={data.vsArchetypes.map((a) => ({
              key: archetypeLabel(a),
              label: archetypeLabel(a),
              wins: a.wins,
              losses: a.losses,
              draws: a.draws,
            }))}
          />
        </>
      )}
    </main>
  );
}
