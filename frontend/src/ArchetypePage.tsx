import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { fetchArchetype } from "./api";
import { BackLink } from "./BackLink";
import { CardLink } from "./CardLink";
import { ColorIdentity } from "./ManaSymbols";
import { SortableTh } from "./SortableTh";
import { Bar } from "./Bar";
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

  // Each table sorts independently. Numbers default to descending, text ascending.
  const [matchupSort, setMatchupSort] = useState<{ col: MatchupCol; dir: Dir }>({ col: "matches", dir: "desc" });
  const [cardSort, setCardSort] = useState<{ col: CardCol; dir: Dir }>({ col: "inclusion", dir: "desc" });

  function sortMatchups(col: MatchupCol) {
    setMatchupSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "opponent" ? "asc" : "desc" },
    );
  }
  function sortCards(col: CardCol) {
    setCardSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "name" ? "asc" : "desc" },
    );
  }

  const matchups = [...(data?.matchups ?? [])].sort((a, b) => {
    const s = matchupSort.dir === "asc" ? 1 : -1;
    if (matchupSort.col === "opponent") return a.opponent.localeCompare(b.opponent) * s;
    if (matchupSort.col === "winrate") return (a.winrate - b.winrate) * s;
    return (a.matches - b.matches) * s;
  });
  const cards = [...(data?.cards ?? [])].sort((a, b) => {
    const s = cardSort.dir === "asc" ? 1 : -1;
    return cardSort.col === "name"
      ? a.name.localeCompare(b.name) * s
      : (a.inclusion - b.inclusion) * s;
  });

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
          <p style={{ color: "#555", margin: "0 0 1.25rem" }}>
            {data.deckCount.toLocaleString()} decks
            {data.overallWinrate != null && (
              <>
                {" · "}
                <strong style={{ color: winrateColor(data.overallWinrate) }}>
                  {data.overallWinrate}% win rate
                </strong>
                {data.overallMatches != null &&
                  ` (${data.overallMatches.toLocaleString()} matches)`}
              </>
            )}
            {" · "}
            <Link to={`/decks?archetypes=${encodeURIComponent(data.name)}`}>
              Browse these decks →
            </Link>
          </p>

          {data.matchups.length > 0 && (
            <>
              <h2 style={{ marginBottom: "0.25rem" }}>Matchups</h2>
              <p style={{ color: "#555", marginTop: 0 }}>
                Head-to-head win rates from mtgdecks, against the most-played
                archetypes.
              </p>

              <table className="data-table" style={{ maxWidth: 520 }}>
                <thead>
                  <tr>
                    <SortableTh label="Opponent" active={matchupSort.col === "opponent"} dir={matchupSort.dir} onClick={() => sortMatchups("opponent")} />
                    <SortableTh label="Win rate" width={220} active={matchupSort.col === "winrate"} dir={matchupSort.dir} onClick={() => sortMatchups("winrate")} />
                    <SortableTh label="Matches" align="right" active={matchupSort.col === "matches"} dir={matchupSort.dir} onClick={() => sortMatchups("matches")} />
                  </tr>
                </thead>
                <tbody>
                  {matchups.map((m) => (
                    <tr key={m.opponent}>
                      <td>
                        <Link to={`/archetypes/${encodeURIComponent(m.opponent)}`}>{m.opponent}</Link>
                      </td>
                      <td>
                        <Bar ratio={m.winrate / 100} label={`${m.winrate}%`} color={winrateColor(m.winrate)} />
                      </td>
                      <td className="num" style={{ color: "#555" }}>
                        {m.matches.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <h2 style={{ margin: "1.75rem 0 0.25rem" }}>How it's classified</h2>
          <p style={{ color: "#555", marginTop: 0 }}>
            A deck is scored against this archetype's card profile (inclusion rate ×
            distinctiveness). The cards below are how often each appears in the
            archetype's decks — the high-inclusion ones are its signature.
          </p>

          <table className="data-table" style={{ maxWidth: 520 }}>
            <thead>
              <tr>
                <SortableTh label="Card" active={cardSort.col === "name"} dir={cardSort.dir} onClick={() => sortCards("name")} />
                <SortableTh label="Inclusion" width={220} active={cardSort.col === "inclusion"} dir={cardSort.dir} onClick={() => sortCards("inclusion")} />
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.name}>
                  <td>
                    <CardLink name={c.name} />
                  </td>
                  <td>
                    <Bar ratio={c.inclusion} label={`${Math.round(c.inclusion * 100)}%`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
