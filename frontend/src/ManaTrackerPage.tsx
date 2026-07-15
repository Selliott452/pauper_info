import { useEffect, useState } from "react";
import { IconMinus, IconPlus, IconRefresh, IconSettings } from "@tabler/icons-react";
import { ManaSymbols } from "./ManaSymbols";
import { Modal } from "./Modal";
import { COLORS } from "./colors";

// Mana pips tracked here, in the order they're displayed: the five colors plus
// generic/colorless mana (e.g. from Tron lands or artifact sources).
const PIPS = [...COLORS, { code: "C", label: "Colorless" }] as const;

type PipCode = (typeof PIPS)[number]["code"];

const ZERO_MANA = Object.fromEntries(PIPS.map((p) => [p.code, 0])) as Record<PipCode, number>;

// Which pips/counters are shown, persisted locally so a player's setup (e.g.
// hiding colors they never play) sticks between visits. Defaults to everything on.
type Visibility = Record<PipCode, boolean> & { storm: boolean };

const ALL_VISIBLE: Visibility = {
  ...(Object.fromEntries(PIPS.map((p) => [p.code, true])) as Record<PipCode, boolean>),
  storm: true,
};

const STORAGE_KEY = "mana-tracker-visibility";

function loadVisibility(): Visibility {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...ALL_VISIBLE, ...JSON.parse(raw) } : ALL_VISIBLE;
  } catch {
    return ALL_VISIBLE;
  }
}

// A simple on-screen counter for floating mana and storm count, meant to be kept
// open on a phone or second monitor during a game. Counts are local/ephemeral -
// nothing here is synced - but which pips/counters are shown is remembered.
export function ManaTrackerPage() {
  const [mana, setMana] = useState(ZERO_MANA);
  const [storm, setStorm] = useState(0);
  const [visible, setVisible] = useState(loadVisibility);
  const [configuring, setConfiguring] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visible));
  }, [visible]);

  const bump = (code: PipCode, delta: number) => {
    setMana((m) => ({ ...m, [code]: Math.max(0, m[code] + delta) }));
  };

  const totalMana = Object.values(mana).reduce((a, b) => a + b, 0);
  const shownPips = PIPS.filter((p) => visible[p.code]);
  const nothingShown = shownPips.length === 0 && !visible.storm;
  const nothingToReset = totalMana === 0 && storm === 0;

  const resetAll = () => {
    setMana(ZERO_MANA);
    setStorm(0);
  };

  return (
    <main className="page mana-tracker-page">
      <div className="mana-tracker-title-row">
        <h1>Mana Tracker</h1>
        <div className="mana-tracker-title-actions">
          <button className="pill" onClick={resetAll} disabled={nothingToReset}>
            <IconRefresh size={14} stroke={2} /> Reset
          </button>
          <button className="pill" onClick={() => setConfiguring(true)}>
            <IconSettings size={14} stroke={2} /> Configure
          </button>
        </div>
      </div>

      {nothingShown && <p className="muted">Everything's hidden - use Configure to show something.</p>}

      {shownPips.length > 0 && (
        <section className="mana-tracker-section">
          <h2>Floating mana</h2>
          <div className="mana-tracker-grid">
            {shownPips.map((p) => (
              <div key={p.code} className={`mana-tracker-card mana-tracker-card-${p.code.toLowerCase()}`}>
                <button
                  className="mana-tracker-half mana-tracker-half-minus"
                  aria-label={`Remove ${p.label} mana`}
                  onClick={() => bump(p.code, -1)}
                  disabled={mana[p.code] === 0}
                >
                  <IconMinus size={16} stroke={2.5} />
                </button>
                <button
                  className="mana-tracker-half mana-tracker-half-plus"
                  aria-label={`Add ${p.label} mana`}
                  onClick={() => bump(p.code, 1)}
                >
                  <IconPlus size={16} stroke={2.5} />
                </button>
                <div className="mana-tracker-card-content">
                  <div className="mana-tracker-symbol">
                    <ManaSymbols text={`{${p.code}}`} />
                  </div>
                  <div className="mana-tracker-count">{mana[p.code]}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {visible.storm && (
        <section className="mana-tracker-section">
          <h2>Storm count</h2>
          <div className="mana-tracker-storm">
            <button
              className="mana-tracker-half mana-tracker-half-minus"
              aria-label="Decrease storm count"
              onClick={() => setStorm((s) => Math.max(0, s - 1))}
              disabled={storm === 0}
            >
              <IconMinus size={20} stroke={2.5} />
            </button>
            <button
              className="mana-tracker-half mana-tracker-half-plus"
              aria-label="Increase storm count"
              onClick={() => setStorm((s) => s + 1)}
            >
              <IconPlus size={20} stroke={2.5} />
            </button>
            <div className="mana-tracker-storm-content">
              <div className="mana-tracker-storm-count">{storm}</div>
            </div>
          </div>
        </section>
      )}

      {configuring && (
        <ConfigureModal visible={visible} onChange={setVisible} onClose={() => setConfiguring(false)} />
      )}
    </main>
  );
}

// Lets the player toggle which color pips and the storm counter are shown.
function ConfigureModal({
  visible,
  onChange,
  onClose,
}: {
  visible: Visibility;
  onChange: (v: Visibility) => void;
  onClose: () => void;
}) {
  const toggle = (key: keyof Visibility) => onChange({ ...visible, [key]: !visible[key] });

  return (
    <Modal width={340} onClose={onClose}>
      <h3 style={{ marginTop: 0 }}>Configure tracker</h3>
      <p className="page-subtitle" style={{ marginBottom: "0.75rem" }}>
        Choose which counters show on the page.
      </p>
      <div className="mana-tracker-config-list">
        {PIPS.map((p) => (
          <button
            key={p.code}
            className={`pill mana-tracker-config-pill ${visible[p.code] ? "active" : ""}`}
            onClick={() => toggle(p.code)}
          >
            <ManaSymbols text={`{${p.code}}`} /> {p.label}
          </button>
        ))}
        <button
          className={`pill mana-tracker-config-pill ${visible.storm ? "active" : ""}`}
          onClick={() => toggle("storm")}
        >
          Storm count
        </button>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.1rem" }}>
        <button className="pill active" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
