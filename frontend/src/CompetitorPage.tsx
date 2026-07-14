import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "./BackLink";
import { Loading } from "./QueryState";
import { RecordTable } from "./RecordTable";
import { ArchetypeLink } from "./ArchetypeLink";
import { pct, archetypeLabel } from "./format";
import { fetchCompetitor, resolveCompetitor, type OpponentRecord } from "./api";

// The :id route param can be a numeric id ("1"), a name slug ("josh-e"), or a
// partial name ("josh"). A number loads the page directly; anything else is sent to
// the backend resolver, which either points at one competitor or lists candidates.
export function CompetitorPage() {
  const param = useParams().id ?? "";
  if (/^\d+$/.test(param)) return <CompetitorDetailView id={Number(param)} />;
  return <CompetitorResolver identifier={param} />;
}

// Resolves a non-numeric identifier: render the page in place when unique (keeping the
// slug/partial URL), otherwise show the list of competitors whose names matched.
function CompetitorResolver({ identifier }: { identifier: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["competitor-resolve", identifier],
    queryFn: () => resolveCompetitor(identifier),
  });

  if (isLoading) {
    return (
      <main className="page">
        <BackLink />
        <Loading />
      </main>
    );
  }

  if (data?.competitorId != null) {
    return <CompetitorDetailView id={data.competitorId} />;
  }

  const candidates = data?.candidates ?? [];

  return (
    <main className="page">
      <BackLink />
      {candidates.length === 0 ? (
        <p style={{ color: "#666" }}>No player matches “{identifier}”.</p>
      ) : (
        <>
          <h1 style={{ marginBottom: "0.25rem" }}>Players matching “{identifier}”</h1>
          <p style={{ color: "#555", margin: "0 0 1rem" }}>{candidates.length} players match. Pick one:</p>
          <table className="data-table" style={{ maxWidth: 560 }}>
            <thead>
              <tr>
                <th>Player</th>
                <th className="center">Events</th>
                <th className="center">Record</th>
                <th className="num">Match win%</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id}>
                  <td data-label="Player">
                    <Link to={`/tournaments/players/${c.id}`}>{c.name}</Link>
                  </td>
                  <td className="center" data-label="Events">{c.events}</td>
                  <td className="center" data-label="Record">
                    {c.wins}-{c.losses}-{c.draws}
                  </td>
                  <td className="num" data-label="Match win%">{pct(c.matchWinPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}

function CompetitorDetailView({ id }: { id: number }) {
  const { data, isLoading } = useQuery({ queryKey: ["competitor", id], queryFn: () => fetchCompetitor(id) });

  return (
    <main className="page">
      <BackLink />

      {isLoading && <Loading />}
      {data && (
        <>
          <h1 style={{ marginBottom: "0.25rem" }}>{data.name}</h1>
          <p style={{ color: "#555", margin: "0 0 1.5rem" }}>
            {data.events} event{data.events === 1 ? "" : "s"} · Matches {data.wins}-{data.losses}-{data.draws} (
            {pct(data.matchWinPct)}) · Games {data.gameWins}-{data.gameLosses}-{data.gameDraws} ({pct(data.gameWinPct)})
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
                    <td data-label="Tournament">
                      <Link to={`/tournaments/${r.eventId}`}>{r.eventName}</Link>
                    </td>
                    <td className="center" data-label="Finish">
                      {r.rank} / {r.players}
                    </td>
                    <td className="center" data-label="Record">
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
            showGames
            rows={data.archetypesPlayed.map((a) => ({
              key: archetypeLabel(a),
              name: archetypeLabel(a),
              label: <ArchetypeLink archetype={a.archetype} />,
              wins: a.wins,
              losses: a.losses,
              draws: a.draws,
              gameWins: a.gameWins,
              gameLosses: a.gameLosses,
              gameDraws: a.gameDraws,
            }))}
          />

          <RecordTable
            heading="Record vs player"
            firstCol="Opponent"
            showGames
            rows={data.vsPlayers.map((o: OpponentRecord) => ({
              key: o.opponentId != null ? `c${o.opponentId}` : o.opponentName,
              name: o.opponentName,
              label: o.opponentId != null ? <Link to={`/tournaments/players/${o.opponentId}`}>{o.opponentName}</Link> : o.opponentName,
              wins: o.wins,
              losses: o.losses,
              draws: o.draws,
              gameWins: o.gameWins,
              gameLosses: o.gameLosses,
              gameDraws: o.gameDraws,
            }))}
          />

          <RecordTable
            heading="Record vs archetype"
            firstCol="Opponent archetype"
            showGames
            rows={data.vsArchetypes.map((a) => ({
              key: archetypeLabel(a),
              name: archetypeLabel(a),
              label: <ArchetypeLink archetype={a.archetype} />,
              wins: a.wins,
              losses: a.losses,
              draws: a.draws,
              gameWins: a.gameWins,
              gameLosses: a.gameLosses,
              gameDraws: a.gameDraws,
            }))}
          />
        </>
      )}
    </main>
  );
}
