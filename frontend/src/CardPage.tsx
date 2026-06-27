import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "./BackLink";
import { fetchCardArchetypes, fetchCardDetail, fetchCooccurrences } from "./api";
import { CardLink } from "./CardLink";
import { ManaSymbols, ColorSymbols } from "./ManaSymbols";
import { Bar } from "./Bar";
import { Loading } from "./QueryState";
import { formatAvg } from "./format";

function StatTile({ value, label, to }: { value: string; label: string; to?: string }) {
  const style = {
    position: "relative",
    flex: "1 1 120px",
    minWidth: 120,
    background: "#fafafa",
    border: "1px solid #ececec",
    borderRadius: 8,
    padding: "0.75rem 1rem",
    textDecoration: "none",
    color: "inherit",
    display: "block",
  } as const;
  const inner = (
    <>
      {to && (
        <span style={{ position: "absolute", top: 5, right: 8, color: "#2563eb", fontSize: "1.05rem", fontWeight: 700 }}>
          ↗
        </span>
      )}
      <div style={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>{label}</div>
    </>
  );
  return to ? (
    <Link to={to} className="stat-tile-link" style={style}>
      {inner}
    </Link>
  ) : (
    <div style={style}>{inner}</div>
  );
}

// Renders oracle text, splitting double-faced cards into per-face blocks with
// the face name as a header and a divider, instead of a raw "//" line.
function OracleText({ name, text }: { name: string; text: string }) {
  const faceTexts = text.split("\n//\n");
  if (faceTexts.length <= 1) {
    return (
      <p style={{ whiteSpace: "pre-wrap" }}>
        <ManaSymbols text={text} />
      </p>
    );
  }
  const faceNames = name.split(" // ");
  return (
    <div>
      {faceTexts.map((faceText, i) => (
        <div key={i}>
          {i > 0 && (
            <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "0.9rem 0" }} />
          )}
          {faceNames[i] && (
            <div style={{ fontWeight: 600, marginBottom: "0.15rem" }}>{faceNames[i]}</div>
          )}
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            <ManaSymbols text={faceText} />
          </p>
        </div>
      ))}
    </div>
  );
}

export function CardPage() {
  const { name = "" } = useParams();
  const [showBack, setShowBack] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["card-detail", name],
    queryFn: () => fetchCardDetail(name),
  });

  const cooccurQuery = useQuery({
    queryKey: ["cooccurrences", name],
    queryFn: () => fetchCooccurrences(name),
  });

  const archetypeQuery = useQuery({
    queryKey: ["card-archetypes", name],
    queryFn: () => fetchCardArchetypes(name),
  });

  const card = detailQuery.data;
  const cooccur = cooccurQuery.data;
  // Top 5 most-central archetypes (the API returns them ordered by inclusion).
  const archetypes = (archetypeQuery.data ?? []).slice(0, 5);

  return (
    <main className="page">
      <div>
        <BackLink />
      </div>

      {detailQuery.isLoading && <Loading />}
      {detailQuery.data === null && <p>Card not found.</p>}

      {card && (
        <div style={{ display: "flex", gap: "1.5rem", marginTop: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
          {card.imageUri && (
            <div style={{ flexShrink: 0 }}>
              <img
                src={showBack && card.backImageUri ? card.backImageUri : card.imageUri}
                alt={card.name}
                onMouseEnter={() => setShowBack(true)}
                onMouseLeave={() => setShowBack(false)}
                style={{ width: 280, height: "auto", borderRadius: 12, display: "block" }}
              />
              {card.backImageUri && (
                <p style={{ color: "#888", fontSize: "0.85rem", textAlign: "center", margin: "0.25rem 0 0" }}>
                  Hover to flip
                </p>
              )}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 280 }}>
            <h1 style={{ marginTop: 0 }}>{card.name}</h1>
            <p style={{ color: "#555" }}>
              {card.typeLine}
              {card.manaCost && (
                <>
                  {" · "}
                  <ManaSymbols text={card.manaCost} />
                </>
              )}
              {" · "}
              <a
                href={`https://scryfall.com/search?q=${encodeURIComponent(`!"${card.name}"`)}`}
                target="_blank"
                rel="noreferrer"
              >
                View on Scryfall ↗
              </a>
            </p>
            {card.oracleText && (
              <OracleText name={card.name} text={card.oracleText} />
            )}

            <h2 style={{ marginBottom: "0.5rem" }}>Play statistics</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                <StatTile
                  value={card.mainboardDeckCount.toLocaleString()}
                  label="Mainboard decks"
                  to={`/decks?mainboardCards=${encodeURIComponent(card.name)}`}
                />
                <StatTile
                  value={card.sideboardDeckCount.toLocaleString()}
                  label="Sideboard decks"
                  to={`/decks?sideboardCards=${encodeURIComponent(card.name)}`}
                />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                <StatTile
                  value={formatAvg(card.avgMainboardQuantity)}
                  label="Avg copies (main)"
                />
                <StatTile
                  value={formatAvg(card.avgSideboardQuantity)}
                  label="Avg copies (side)"
                />
                <StatTile
                  value={formatAvg(card.avgTotalQuantity)}
                  label="Avg copies (total)"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {archetypes.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={{ marginBottom: "0.5rem" }}>Archetypes</h2>
          <p style={{ color: "#555", marginTop: 0 }}>
            Archetypes whose decklists include {card?.name ?? name}, and how often it
            appears in each (its inclusion rate).
          </p>
          <table className="data-table" style={{ maxWidth: 520 }}>
            <thead>
              <tr>
                <th>Archetype</th>
                <th style={{ width: 220 }}>Inclusion</th>
              </tr>
            </thead>
            <tbody>
              {archetypes.map((a) => (
                <tr key={a.archetype}>
                  <td data-label="Archetype">
                    <Link to={`/archetypes/${encodeURIComponent(a.archetype)}`}>{a.archetype}</Link>
                  </td>
                  <td data-label="Inclusion">
                    <Bar ratio={a.inclusion} label={`${Math.round(a.inclusion * 100)}%`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section style={{ marginTop: "2rem" }}>
        <h2>Played with</h2>
        {cooccurQuery.isLoading && <Loading />}
        {cooccur && (
          <>
            <p style={{ color: "#555" }}>
              Cards appearing in the {cooccur.deckCount.toLocaleString()} mainboard
              decks that run {cooccur.cardName}.
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Card</th>
                  <th className="num">Decks</th>
                  <th className="num">% of decks</th>
                </tr>
              </thead>
              <tbody>
                {cooccur.cooccurrences.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Card">
                      <CardLink name={c.name} />
                      {c.colors.length > 0 && (
                        <span style={{ marginLeft: 6 }}>
                          <ColorSymbols colors={c.colors} />
                        </span>
                      )}
                    </td>
                    <td className="num" data-label="Decks">{c.deckCount.toLocaleString()}</td>
                    <td className="num" data-label="% of decks">
                      {cooccur.deckCount > 0 ? `${((c.deckCount / cooccur.deckCount) * 100).toFixed(1)}%` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </main>
  );
}
