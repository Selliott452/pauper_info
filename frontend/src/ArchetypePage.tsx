import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { fetchArchetype, fetchArchetypeMatchups, type MatchupSource } from "./api";
import { BackLink } from "./BackLink";
import { CardLink } from "./CardLink";
import { ColorIdentity } from "./ManaSymbols";
import { SortableTh } from "./SortableTh";
import { Bar } from "./Bar";
import { RecordTable } from "./RecordTable";
import { Loading } from "./QueryState";
import { winrateColor } from "./winrate";

type Dir = "asc" | "desc";
type MatchupCol = "opponent" | "winrate" | "matches";
type CardCol = "name" | "inclusion";

export function ArchetypePage() {
  const { name = "" } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["archetype", name],
    queryFn: () => fetchArchetype(name),
  });

  // Each table sorts independently. Unset by default: rows show in the API's
  // natural order until a header is clicked. Numbers start descending, text ascending.
  const [matchupSort, setMatchupSort] = useState<{ col: MatchupCol; dir: Dir } | null>(null);
  const [cardSort, setCardSort] = useState<{ col: CardCol; dir: Dir } | null>(null);

  function sortMatchups(col: MatchupCol) {
    setMatchupSort((s) =>
      s?.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "opponent" ? "asc" : "desc" },
    );
  }
  function sortCards(col: CardCol) {
    setCardSort((s) =>
      s?.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "name" ? "asc" : "desc" },
    );
  }

  const [showAllMatchups, setShowAllMatchups] = useState(false);
  const [matchupSource, setMatchupSource] = useState<MatchupSource>("global");

  // Matchups are fetched per source so the user can switch between the scraped
  // global figures and their own tournament/casual records.
  const { data: matchupData } = useQuery({
    queryKey: ["archetype-matchups", name, matchupSource],
    queryFn: () => fetchArchetypeMatchups(name, matchupSource),
    enabled: !!data,
  });
  const allMatchups = matchupData ?? [];
  const matchups = matchupSort
    ? [...allMatchups].sort((a, b) => {
        const s = matchupSort.dir === "asc" ? 1 : -1;
        if (matchupSort.col === "opponent") return a.opponent.localeCompare(b.opponent) * s;
        if (matchupSort.col === "winrate") return (a.winrate - b.winrate) * s;
        return (a.matches - b.matches) * s;
      })
    : allMatchups;

  // Collapsed by default (when unsorted and there are more than 10): show only the
  // 5 best and 5 worst matchups by win rate. Sorting a column expands to the full list.
  const collapsedMatchups = !matchupSort && !showAllMatchups && allMatchups.length > 10;
  const byWinrate = [...allMatchups].sort((a, b) => b.winrate - a.winrate);
  const displayMatchups = collapsedMatchups ? [...byWinrate.slice(0, 5), ...byWinrate.slice(-5)] : matchups;
  // Index at which the "best" group ends and the "worst" group begins (for a divider).
  const splitIndex = collapsedMatchups ? 5 : -1;
  const [showAllCards, setShowAllCards] = useState(false);

  const allCards = data?.cards ?? [];
  const cards = cardSort
    ? [...allCards].sort((a, b) => {
        const s = cardSort.dir === "asc" ? 1 : -1;
        return cardSort.col === "name" ? a.name.localeCompare(b.name) * s : (a.inclusion - b.inclusion) * s;
      })
    : allCards;

  // Collapsed by default (when unsorted and there are more than 10): show only the
  // 10 highest-inclusion cards. Sorting a column expands to the full list.
  const collapsedCards = !cardSort && !showAllCards && allCards.length > 10;
  const displayCards = collapsedCards ? [...allCards].sort((a, b) => b.inclusion - a.inclusion).slice(0, 10) : cards;

  return (
    <main className="page">
      <div>
        <BackLink />
      </div>

      {isLoading && <Loading />}
      {data === null && <p>Archetype not found.</p>}

      {data && (
        <>
          <h1 style={{ marginBottom: "0.25rem" }}>
            {data.name}
            <span style={{ marginLeft: 8, fontSize: "0.7em", verticalAlign: "middle" }}>
              <ColorIdentity colors={data.colors} />
            </span>
          </h1>
          <p style={{ color: "#555", margin: "0 0 0.5rem" }}>
            {data.deckCount.toLocaleString()} decks
            {" · "}
            <Link to={`/decks?archetypes=${encodeURIComponent(data.name)}`}>
              Browse these decks →
            </Link>
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", margin: "0 0 0.25rem" }}>
            <WinrateStat label="Global" winrate={data.overallWinrate} matches={data.overallMatches} />
            <WinrateStat label="Tournament" winrate={data.tournamentWinrate} matches={data.tournamentMatches} />
            <WinrateStat label="Casual" winrate={data.casualWinrate} matches={data.casualMatches} />
          </div>

          {/* Pull up to counter the first table heading's top margin so the grids sit
              close under the header stats. */}
          <section style={{ marginTop: "-1rem", marginBottom: "1.75rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                <RecordTable
                  heading="In tournaments"
                  firstCol="Player"
                  emptyMessage="No recorded tournament games yet."
                  rows={data.tournamentPlayers.map((p) => ({
                    key: p.playerId != null ? `c${p.playerId}` : p.name,
                    label: p.playerId != null ? <Link to={`/players/${p.playerId}`}>{p.name}</Link> : p.name,
                    wins: p.wins,
                    losses: p.losses,
                    draws: p.draws,
                  }))}
                />
              </div>

              <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                <RecordTable
                  heading="In casual play"
                  firstCol="Player"
                  emptyMessage="No recorded casual games yet."
                  rows={data.casualPlayers.map((p) => ({
                    key: p.playerId != null ? `p${p.playerId}` : p.name,
                    label: p.playerId != null ? <Link to={`/matches/players/${p.playerId}`}>{p.name}</Link> : p.name,
                    wins: p.wins,
                    losses: p.losses,
                    draws: p.draws,
                  }))}
                />
              </div>
            </div>
          </section>

          <div className="aligned-cols">
          {(data.matchups.length > 0 || data.tournamentMatches > 0 || data.casualMatches > 0) && (
            <section>
              <h2 style={{ marginBottom: "0.25rem", marginTop: 0 }}>Matchups</h2>

              <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
                {(["global", "tournament", "casual"] as MatchupSource[]).map((s) => (
                  <button
                    key={s}
                    className={`pill ${matchupSource === s ? "active" : ""}`}
                    style={{ textTransform: "capitalize" }}
                    onClick={() => {
                      setMatchupSource(s);
                      setShowAllMatchups(false);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: "0.6rem" }}>
              {allMatchups.length === 0 ? (
                <p style={{ color: "#666" }}>No {matchupSource} matchups recorded.</p>
              ) : (
                <>
                  <table className="data-table" style={{ maxWidth: 520 }}>
                    <thead>
                      <tr>
                        <SortableTh label="Opponent" active={matchupSort?.col === "opponent"} dir={matchupSort?.dir ?? "desc"} onClick={() => sortMatchups("opponent")} />
                        <SortableTh label="Win rate" width={220} active={matchupSort?.col === "winrate"} dir={matchupSort?.dir ?? "desc"} onClick={() => sortMatchups("winrate")} />
                        <SortableTh label="Matches" align="right" active={matchupSort?.col === "matches"} dir={matchupSort?.dir ?? "desc"} onClick={() => sortMatchups("matches")} />
                      </tr>
                    </thead>
                    <tbody>
                      {displayMatchups.map((m, i) => (
                        <Fragment key={m.opponent}>
                          {i === splitIndex && (
                            <tr>
                              <td colSpan={3} style={{ textAlign: "center", color: "#999", fontSize: "0.85rem", padding: "0.3rem" }}>
                                ⋯ {allMatchups.length - 10} more ⋯
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td data-label="Opponent">
                              <Link to={`/archetypes/${encodeURIComponent(m.opponent)}`}>{m.opponent}</Link>
                            </td>
                            <td data-label="Win rate">
                              <Bar ratio={m.winrate / 100} label={`${m.winrate}%`} color={winrateColor(m.winrate)} />
                            </td>
                            <td className="num" data-label="Matches" style={{ color: "#555" }}>
                              {m.matches.toLocaleString()}
                            </td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>

                  {collapsedMatchups ? (
                    <button className="pill" style={{ marginTop: "0.5rem" }} onClick={() => setShowAllMatchups(true)}>
                      Show all {allMatchups.length} matchups
                    </button>
                  ) : (
                    showAllMatchups &&
                    allMatchups.length > 10 &&
                    !matchupSort && (
                      <button className="pill" style={{ marginTop: "0.5rem" }} onClick={() => setShowAllMatchups(false)}>
                        Show less
                      </button>
                    )
                  )}
                </>
              )}
              </div>
            </section>
          )}

          <section>
          <h2 style={{ margin: "0 0 0.25rem" }}>How it's classified</h2>

          {/* Empty placeholder occupying the matchups toolbar's subgrid row so the
              two tables stay aligned. */}
          <div className="toolbar-placeholder" aria-hidden="true" />

          <div style={{ marginTop: "0.6rem" }}>
          <table className="data-table" style={{ maxWidth: 520 }}>
            <thead>
              <tr>
                <SortableTh label="Card" active={cardSort?.col === "name"} dir={cardSort?.dir ?? "desc"} onClick={() => sortCards("name")} />
                <SortableTh label="Inclusion" width={220} active={cardSort?.col === "inclusion"} dir={cardSort?.dir ?? "desc"} onClick={() => sortCards("inclusion")} />
              </tr>
            </thead>
            <tbody>
              {displayCards.map((c) => (
                <tr key={c.name}>
                  <td data-label="Card">
                    <CardLink name={c.name} />
                  </td>
                  <td data-label="Inclusion">
                    <Bar ratio={c.inclusion} label={`${Math.round(c.inclusion * 100)}%`} />
                  </td>
                </tr>
              ))}
              {collapsedCards && (
                <tr>
                  <td colSpan={2} style={{ textAlign: "center", color: "#999", fontSize: "0.85rem", padding: "0.3rem" }}>
                    ⋯ {allCards.length - 10} more ⋯
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {collapsedCards ? (
            <button className="pill" style={{ marginTop: "0.5rem" }} onClick={() => setShowAllCards(true)}>
              Show all {allCards.length} cards
            </button>
          ) : (
            showAllCards &&
            allCards.length > 10 &&
            !cardSort && (
              <button className="pill" style={{ marginTop: "0.5rem" }} onClick={() => setShowAllCards(false)}>
                Show less
              </button>
            )
          )}
          </div>
          </section>
          </div>
        </>
      )}
    </main>
  );
}

// A labelled win-rate stat (Global / Tournament / Casual) with its match count,
// or a dash when there's no data.
function WinrateStat({ label, winrate, matches }: { label: string; winrate: number | null; matches: number | null }) {
  return (
    <div>
      <div style={{ fontSize: "0.8rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
      {winrate != null ? (
        <div>
          <strong style={{ fontSize: "1.15rem", color: winrateColor(winrate) }}>{winrate}%</strong>
          {matches != null && <span style={{ color: "#888", fontSize: "0.85rem" }}> · {matches.toLocaleString()} matches</span>}
        </div>
      ) : (
        <div style={{ color: "#aaa", fontSize: "1.15rem" }}>-</div>
      )}
    </div>
  );
}
