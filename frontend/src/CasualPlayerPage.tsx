import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "./BackLink";
import { Loading } from "./QueryState";
import { RecordTable } from "./RecordTable";
import { ArchetypeLink } from "./ArchetypeLink";
import { pct, archetypeLabel } from "./format";
import { fetchCasualPlayer } from "./api";

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
            rows={data.archetypesPlayed.map((a) => ({ key: archetypeLabel(a), label: <ArchetypeLink archetype={a.archetype} />, wins: a.wins, losses: a.losses, draws: a.draws }))}
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
            rows={data.vsArchetypes.map((a) => ({ key: archetypeLabel(a), label: <ArchetypeLink archetype={a.archetype} />, wins: a.wins, losses: a.losses, draws: a.draws }))}
          />

          {data.recentMatches.length > 0 && (
            <>
              <h2 style={{ margin: "1.5rem 0 0.5rem" }}>Recent matches</h2>
              {/* One shared grid so columns size to their widest content across every
                  row — scores line up regardless of archetype-name length, without
                  the dead space two 1fr columns would leave. */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.1rem max-content max-content max-content 1fr",
                  alignItems: "center",
                  columnGap: "0.5rem",
                  fontSize: "0.9rem",
                }}
              >
                {data.recentMatches.map((m, i) => {
                  const meP1 = m.player1Id === id;
                  const myWins = meP1 ? m.player1Wins : m.player2Wins;
                  const oppWins = meP1 ? m.player2Wins : m.player1Wins;
                  const oppId = meP1 ? m.player2Id : m.player1Id;
                  const oppName = meP1 ? m.player2Name : m.player1Name;
                  const myArch = meP1 ? m.player1Archetype : m.player2Archetype;
                  const oppArch = meP1 ? m.player2Archetype : m.player1Archetype;
                  const myDeck = meP1 ? m.player1DeckUrl : m.player2DeckUrl;
                  const oppDeck = meP1 ? m.player2DeckUrl : m.player1DeckUrl;
                  const result = myWins > oppWins ? "W" : myWins < oppWins ? "L" : "D";
                  const cell = { padding: "0.4rem 0", borderTop: i === 0 ? "none" : "1px solid #f0f0f0" };
                  return (
                    <div key={m.id} style={{ display: "contents" }}>
                      <strong
                        style={{
                          ...cell,
                          textAlign: "center",
                          color: result === "W" ? "#16a34a" : result === "L" ? "#dc2626" : "#999",
                        }}
                      >
                        {result}
                      </strong>
                      <span style={{ ...cell, textAlign: "left" }}>{side(data.name, null, myArch, myDeck)}</span>
                      <strong style={{ ...cell, textAlign: "center", whiteSpace: "nowrap" }}>
                        {myWins}-{oppWins}
                        {m.draws ? `-${m.draws}` : ""}
                      </strong>
                      <span style={cell}>{side(oppName, oppId, oppArch, oppDeck)}</span>
                      <span style={{ ...cell, color: "#999", whiteSpace: "nowrap", textAlign: "right" }}>{m.date ?? ""}</span>
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
