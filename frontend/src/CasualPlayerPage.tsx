import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "./BackLink";
import { Loading } from "./QueryState";
import { RecordTable } from "./RecordTable";
import { ArchetypeLink } from "./ArchetypeLink";
import { pct, archetypeLabel } from "./format";
import { fetchCasualPlayer, resolveCasualPlayer } from "./api";

// One side of a match row: name (linked unless it's the current player), the
// archetype in parens, and a ↗ link to the decklist. Mirrors the matches page.
function side(name: string, playerId: number | null, arch: string | null, deck: string | null) {
  return (
    <>
      {playerId != null ? <Link to={`/matches/players/${playerId}`}>{name}</Link> : <strong>{name}</strong>}
      {arch && <span style={{ color: "#888", fontSize: "0.85rem" }}> ({arch})</span>}
      {deck && (
        <a href={deck} target="_blank" rel="noreferrer" style={{ marginLeft: 4, fontSize: "0.85rem" }}>
          ↗
        </a>
      )}
    </>
  );
}

const PAGE_SIZE = 25;

// The :id route param can be a numeric id ("1"), a name slug ("josh-e"), or a
// partial name ("josh"). A number loads the page directly; anything else is sent to
// the backend resolver, which either points at one player or lists candidates.
export function CasualPlayerPage() {
  const param = useParams().id ?? "";
  if (/^\d+$/.test(param)) return <PlayerDetailView id={Number(param)} />;
  return <PlayerResolver identifier={param} />;
}

// Resolves a non-numeric identifier: redirect to the canonical id page when unique,
// otherwise show the list of players whose names matched.
function PlayerResolver({ identifier }: { identifier: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["casual-player-resolve", identifier],
    queryFn: () => resolveCasualPlayer(identifier),
  });

  if (isLoading) {
    return (
      <main className="page">
        <BackLink />
        <Loading />
      </main>
    );
  }

  // Unique match: render the page in place, keeping the slug/partial URL the user typed.
  if (data?.playerId != null) {
    return <PlayerDetailView id={data.playerId} />;
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
          <p style={{ color: "#555", margin: "0 0 1rem" }}>
            {candidates.length} players match. Pick one:
          </p>
          <table className="data-table" style={{ maxWidth: 560 }}>
            <thead>
              <tr>
                <th>Player</th>
                <th className="center">Matches</th>
                <th className="center">Record</th>
                <th className="num">Win%</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((p) => (
                <tr key={p.id}>
                  <td data-label="Player">
                    <Link to={`/matches/players/${p.id}`}>{p.name}</Link>
                  </td>
                  <td className="center" data-label="Matches">{p.matches}</td>
                  <td className="center" data-label="Record">
                    {p.wins}-{p.losses}-{p.draws}
                  </td>
                  <td className="num" data-label="Win%">{p.matches > 0 ? pct(p.matchWinPct) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}

function PlayerDetailView({ id }: { id: number }) {
  const { data, isLoading } = useQuery({ queryKey: ["casual-player", id], queryFn: () => fetchCasualPlayer(id) });

  const [page, setPage] = useState(0);
  const [myArchFilter, setMyArchFilter] = useState("");
  const [oppArchFilter, setOppArchFilter] = useState("");
  const [oppFilter, setOppFilter] = useState("");

  // Decorate each match with this player's perspective (their side vs the opponent's),
  // so both the filters and the rendered rows work from the same derived fields.
  const rows = (data?.matchHistory ?? []).map((m) => {
    const meP1 = m.player1Id === id;
    return {
      m,
      myWins: meP1 ? m.player1Wins : m.player2Wins,
      oppWins: meP1 ? m.player2Wins : m.player1Wins,
      oppId: meP1 ? m.player2Id : m.player1Id,
      oppName: meP1 ? m.player2Name : m.player1Name,
      myArch: meP1 ? m.player1Archetype : m.player2Archetype,
      oppArch: meP1 ? m.player2Archetype : m.player1Archetype,
      myDeck: meP1 ? m.player1DeckUrl : m.player2DeckUrl,
      oppDeck: meP1 ? m.player2DeckUrl : m.player1DeckUrl,
    };
  });

  // Distinct, sorted option lists for the dropdowns.
  const sortedUnique = (vals: (string | null)[]) =>
    [...new Set(vals.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
  const myArchetypes = sortedUnique(rows.map((r) => r.myArch));
  const oppArchetypes = sortedUnique(rows.map((r) => r.oppArch));
  const opponents = sortedUnique(rows.map((r) => r.oppName));

  const filtered = rows.filter(
    (r) =>
      (!myArchFilter || r.myArch === myArchFilter) &&
      (!oppArchFilter || r.oppArch === oppArchFilter) &&
      (!oppFilter || r.oppName === oppFilter),
  );

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  // Clamp in case the data shrank (e.g. switching players, applying a filter).
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // Set a single match-history filter (clearing the others) and scroll to it.
  const historyRef = useRef<HTMLHeadingElement>(null);
  function viewHistory(apply: () => void) {
    setMyArchFilter("");
    setOppArchFilter("");
    setOppFilter("");
    apply();
    setPage(0);
    historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
            rows={data.archetypesPlayed.map((a) => ({
              key: archetypeLabel(a),
              label: <ArchetypeLink archetype={a.archetype} />,
              wins: a.wins,
              losses: a.losses,
              draws: a.draws,
              onView: a.archetype ? () => viewHistory(() => setMyArchFilter(a.archetype!)) : undefined,
            }))}
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
              onView: () => viewHistory(() => setOppFilter(o.opponentName)),
            }))}
          />

          <RecordTable
            heading="Record vs archetype"
            firstCol="Opponent archetype"
            rows={data.vsArchetypes.map((a) => ({
              key: archetypeLabel(a),
              label: <ArchetypeLink archetype={a.archetype} />,
              wins: a.wins,
              losses: a.losses,
              draws: a.draws,
              onView: a.archetype ? () => viewHistory(() => setOppArchFilter(a.archetype!)) : undefined,
            }))}
          />

          {rows.length > 0 && (
            <>
              <h2 ref={historyRef} style={{ margin: "1.5rem 0 0.5rem", scrollMarginTop: "1rem" }}>
                Match history{" "}
                <span style={{ color: "#999", fontWeight: 400, fontSize: "1rem" }}>
                  ({filtered.length === rows.length ? rows.length : `${filtered.length} of ${rows.length}`})
                </span>
              </h2>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                <select
                  className="text-input"
                  value={myArchFilter}
                  onChange={(e) => {
                    setMyArchFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All my archetypes</option>
                  {myArchetypes.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <select
                  className="text-input"
                  value={oppArchFilter}
                  onChange={(e) => {
                    setOppArchFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All opponent archetypes</option>
                  {oppArchetypes.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <select
                  className="text-input"
                  value={oppFilter}
                  onChange={(e) => {
                    setOppFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All opponents</option>
                  {opponents.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {(myArchFilter || oppArchFilter || oppFilter) && (
                  <button
                    className="pill"
                    onClick={() => {
                      setMyArchFilter("");
                      setOppArchFilter("");
                      setOppFilter("");
                      setPage(0);
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* A shared grid on desktop (columns size to widest content so scores
                  line up); collapses to one card per match on mobile - see .match-history. */}
              <div className="match-history">
                {visible.map(({ m, myWins, oppWins, oppId, oppName, myArch, oppArch, myDeck, oppDeck }) => {
                  const result = myWins > oppWins ? "W" : myWins < oppWins ? "L" : "D";
                  return (
                    <div key={m.id} className="mh-row">
                      <strong
                        className="mh-cell"
                        style={{ textAlign: "center", color: result === "W" ? "#16a34a" : result === "L" ? "#dc2626" : "#999" }}
                      >
                        {result}
                      </strong>
                      <span className="mh-cell mh-mine">{side(data.name, null, myArch, myDeck)}</span>
                      <strong className="mh-cell mh-score">
                        {myWins}-{oppWins}
                        {m.draws ? `-${m.draws}` : ""}
                      </strong>
                      <span className="mh-cell">{side(oppName, oppId, oppArch, oppDeck)}</span>
                      <span className="mh-cell mh-date">{m.date ?? ""}</span>
                    </div>
                  );
                })}
              </div>

              {filtered.length === 0 && <p style={{ color: "#666" }}>No matches for these filters.</p>}

              {pageCount > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.75rem" }}>
                  <button className="pill" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                    Previous
                  </button>
                  <span style={{ color: "#666", fontSize: "0.9rem" }}>
                    Page {safePage + 1} of {pageCount}
                  </span>
                  <button className="pill" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
