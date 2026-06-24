import { Fragment, type ReactNode } from "react";

// Color enum names (from the API) → single-letter mana codes.
const COLOR_CODE: Record<string, string> = {
  WHITE: "W",
  BLUE: "U",
  BLACK: "B",
  RED: "R",
  GREEN: "G",
};

// Renders a card's colors (e.g. ["BLUE","BLACK"]) as mana symbols.
export function ColorSymbols({ colors }: { colors: string[] }) {
  if (colors.length === 0) return null;
  const text = colors.map((c) => `{${COLOR_CODE[c] ?? c}}`).join("");
  return <ManaSymbols text={text} />;
}

// Like ColorSymbols, but renders the colorless pip {C} when there are no colors
// (e.g. a colorless archetype such as Tron) instead of nothing.
export function ColorIdentity({ colors }: { colors: string[] }) {
  return colors.length === 0 ? <ManaSymbols text="{C}" /> : <ColorSymbols colors={colors} />;
}

// Replaces mana/symbol tokens like {U}, {2}, {T}, {W/U} with Scryfall's symbol
// SVGs, leaving the rest of the text intact. Scryfall's filenames are the token
// contents uppercased with slashes removed (e.g. {W/U} -> WU.svg).
const TOKEN = /\{([^}]+)\}/g;

export function ManaSymbols({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const code = match[1].replace(/\//g, "").toUpperCase();
    parts.push(
      <img
        key={`${match.index}-${code}`}
        src={`https://svgs.scryfall.io/card-symbols/${code}.svg`}
        alt={match[0]}
        style={{ height: "1em", verticalAlign: "-0.125em", margin: "0 1px" }}
      />,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}
