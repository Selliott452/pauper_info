import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { fetchDeck, fetchDeckRank, type DeckCardEntry, type DeckDetail } from "./api";
import { CardLink } from "./CardLink";
import { ColorSymbols, ManaSymbols } from "./ManaSymbols";
import { BackLink } from "./BackLink";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { Bar } from "./Bar";
import { Loading } from "./QueryState";

const TYPE_ORDER = [
  "Creature",
  "Planeswalker",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Land",
];

function primaryType(typeLine: string): string {
  return TYPE_ORDER.find((t) => typeLine.includes(t)) ?? "Other";
}

function totalCount(entries: DeckCardEntry[]): number {
  return entries.reduce((sum, e) => sum + e.quantity, 0);
}

// Groups a board's cards by primary type, in canonical order.
function groupByType(entries: DeckCardEntry[]): [string, DeckCardEntry[]][] {
  const groups = new Map<string, DeckCardEntry[]>();
  for (const e of entries) {
    const t = primaryType(e.typeLine);
    (groups.get(t) ?? groups.set(t, []).get(t)!).push(e);
  }
  const order = [...TYPE_ORDER, "Other"];
  return [...groups.entries()].sort(
    (a, b) => order.indexOf(a[0]) - order.indexOf(b[0]),
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
      <div style={{ width: 92, textAlign: "right", fontSize: "0.85rem", color: "#555" }}>
        {label}
      </div>
      <div style={{ flex: 1, background: "#f0f0f0", borderRadius: 4 }}>
        <div
          style={{
            width: `${max > 0 ? (value / max) * 100 : 0}%`,
            background: "#3b82f6",
            height: 16,
            borderRadius: 4,
            minWidth: value > 0 ? 2 : 0,
          }}
        />
      </div>
      <div style={{ width: 28, fontSize: "0.85rem" }}>{value}</div>
    </div>
  );
}

function ManaCurve({ entries }: { entries: DeckCardEntry[] }) {
  const buckets = new Array(8).fill(0); // 0..6, 7+
  for (const e of entries) {
    if (primaryType(e.typeLine) === "Land") continue;
    const b = Math.min(7, Math.floor(e.cmc));
    buckets[b] += e.quantity;
  }
  const max = Math.max(1, ...buckets);
  return (
    <div>
      <h3 style={{ marginBottom: "0.4rem" }}>Mana curve</h3>
      {buckets.map((count, i) => (
        <BarRow key={i} label={i === 7 ? "7+" : String(i)} value={count} max={max} />
      ))}
    </div>
  );
}

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function Breakdown({ entries }: { entries: DeckCardEntry[] }) {
  const colorCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  for (const e of entries) {
    const t = primaryType(e.typeLine);
    typeCounts[t] = (typeCounts[t] ?? 0) + e.quantity;
    // Colors reflect spell colors; lands are excluded (they're counted under Types).
    if (t === "Land") continue;
    if (e.colors.length === 0) {
      colorCounts["Colorless"] = (colorCounts["Colorless"] ?? 0) + e.quantity;
    } else {
      for (const c of e.colors) colorCounts[c] = (colorCounts[c] ?? 0) + e.quantity;
    }
  }
  const maxColor = Math.max(1, ...Object.values(colorCounts));
  const maxType = Math.max(1, ...Object.values(typeCounts));
  return (
    <div>
      <h3 style={{ marginBottom: "0.4rem" }}>Colors (spells)</h3>
      {Object.entries(colorCounts).map(([c, v]) => (
        <BarRow key={c} label={titleCase(c)} value={v} max={maxColor} />
      ))}
      <h3 style={{ margin: "0.8rem 0 0.4rem" }}>Types</h3>
      {[...TYPE_ORDER, "Other"]
        .filter((t) => typeCounts[t])
        .map((t) => (
          <BarRow key={t} label={t} value={typeCounts[t]} max={maxType} />
        ))}
    </div>
  );
}

function Board({ title, entries }: { title: string; entries: DeckCardEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div>
      <h2>
        {title} ({totalCount(entries)})
      </h2>
      <div style={{ columnCount: 2, columnGap: "1.5rem" }}>
        {groupByType(entries).map(([type, group]) => (
          <div
            key={type}
            style={{ marginBottom: "0.75rem", breakInside: "avoid" }}
          >
            <div style={{ fontWeight: 600, color: "#444", marginBottom: "0.2rem" }}>
              {type} ({totalCount(group)})
            </div>
            {group.map((e) => (
              <div key={e.cardId}>
                {e.quantity}× <CardLink name={e.name} />
                {e.manaCost && (
                  <span style={{ marginLeft: 6 }}>
                    <ManaSymbols text={e.manaCost} />
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Shows how the deck was classified and the runner-up archetypes by score.
function DeckClassification({
  deckId,
  assigned,
  confidence,
}: {
  deckId: string;
  assigned: string | null;
  confidence: string | null;
}) {
  const { data } = useQuery({
    queryKey: ["deck-rank", deckId],
    queryFn: () => fetchDeckRank(deckId),
  });
  if (!data) return null;
  const max = Math.max(0.0001, ...data.map((s) => s.score));
  const top = data[0]?.score ?? 0;
  const margin = top - (data[1]?.score ?? 0);
  const runnerUp = data[1]?.archetype;

  return (
    <section style={{ marginTop: "1.25rem" }}>
      <h2 style={{ marginBottom: "0.25rem" }}>Classification</h2>
      <p style={{ color: "#555", marginTop: 0 }}>
        Classified as <strong>{assigned ?? "Other"}</strong>
        <ConfidenceBadge
          level={confidence}
          title={`match ${top.toFixed(2)}${runnerUp ? `, +${margin.toFixed(2)} over ${runnerUp}` : ""}`}
        />
        {assigned
          ? " - its highest-scoring match against each archetype's card profile (inclusion × distinctiveness)."
          : " - no archetype scored above the match threshold."}
      </p>
      <table className="data-table" style={{ maxWidth: 520 }}>
        <thead>
          <tr>
            <th>Archetype</th>
            <th style={{ width: 200 }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((s) => {
            const isAssigned = s.archetype === assigned;
            return (
              <tr key={s.archetype}>
                <td style={{ fontWeight: isAssigned ? 700 : 400 }}>
                  <Link to={`/archetypes/${encodeURIComponent(s.archetype)}`}>{s.archetype}</Link>
                  {isAssigned && <span style={{ color: "#16a34a" }}> ✓</span>}
                </td>
                <td>
                  <Bar ratio={s.score / max} label={s.score.toFixed(2)} color={isAssigned ? "#16a34a" : "#9aa0a6"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// The full deck view (header, decklist, charts, classification). Reused by the
// deck page and the random-deck picker.
export function DeckView({ deck, showClassification = true }: { deck: DeckDetail; showClassification?: boolean }) {
  return (
    <>
      <h1 style={{ marginBottom: "0.25rem" }}>{deck.name ?? "(untitled deck)"}</h1>
      <p style={{ color: "#555", margin: "0 0 0.5rem" }}>
        {deck.author && <>by {deck.author} · </>}
        <ColorSymbols colors={deck.colors} />
        {deck.updatedAt && <> · updated {new Date(deck.updatedAt).toLocaleDateString()}</>}
        {" · "}
        <a href={`https://moxfield.com/decks/${deck.id}`} target="_blank" rel="noreferrer">
          View on Moxfield ↗
        </a>
      </p>

      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <div style={{ flex: "2 1 380px" }}>
          <Board title="Mainboard" entries={deck.mainboard} />
          <Board title="Sideboard" entries={deck.sideboard} />
        </div>
        <div style={{ flex: "1 1 240px", minWidth: 240 }}>
          <ManaCurve entries={deck.mainboard} />
          <div style={{ marginTop: "1rem" }}>
            <Breakdown entries={deck.mainboard} />
          </div>
        </div>
      </div>

      {showClassification && (
        <DeckClassification deckId={deck.id} assigned={deck.archetype} confidence={deck.archetypeConfidence} />
      )}
    </>
  );
}

export function DeckPage() {
  const { id = "" } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["deck", id],
    queryFn: () => fetchDeck(id),
  });

  return (
    <main className="page">
      <div>
        <BackLink />
      </div>
      {isLoading && <Loading />}
      {data === null && <p>Deck not found.</p>}
      {data && <DeckView deck={data} />}
    </main>
  );
}
