import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";

// Shared keyboard handling for the comboboxes: arrows move the active option,
// Enter/Escape are delegated to the caller. Returns the onKeyDown handler.
function useArrowKeys(
  count: number,
  setActiveIndex: (updater: (i: number) => number) => void,
  onEnter: (e: KeyboardEvent<HTMLInputElement>) => void,
) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, count - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      onEnter(e);
    } else if (e.key === "Escape") {
      e.currentTarget.blur();
    }
  };
}

// The dropdown list. `items` are already filtered/sliced by the caller.
function Menu<T>({
  items,
  activeIndex,
  setActiveIndex,
  onPick,
  renderItem,
  emptyText,
  width,
}: {
  items: T[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onPick: (item: T) => void;
  renderItem: (item: T) => string;
  emptyText?: string;
  width?: number;
}) {
  if (items.length === 0 && !emptyText) return null;
  return (
    <ul className="combobox-menu" style={{ width }}>
      {items.length === 0 && emptyText && (
        <li style={{ padding: "0.4rem 0.6rem", color: "#999" }}>{emptyText}</li>
      )}
      {items.map((item, i) => (
        <li key={renderItem(item) + i}>
          <button
            type="button"
            className={`combobox-option${i === activeIndex ? " active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(item);
            }}
            onMouseEnter={() => setActiveIndex(i)}
          >
            {renderItem(item)}
          </button>
        </li>
      ))}
    </ul>
  );
}

// Single-value combobox: type to filter a dropdown of suggestions (click or
// keyboard to pick), while still allowing free text (e.g. a brand-new name).
export function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  block = false,
  inputStyle,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  block?: boolean;
  inputStyle?: CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    return (q ? options.filter((o) => o.toLowerCase().includes(q)) : options).slice(0, 10);
  }, [value, options]);

  function pick(v: string) {
    onChange(v);
    setActiveIndex(0);
  }

  const onKeyDown = useArrowKeys(suggestions.length, setActiveIndex, (e) => {
    if (focused && suggestions.length > 0) {
      e.preventDefault();
      pick(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
      e.currentTarget.blur();
    }
  });

  return (
    <div style={{ position: "relative", display: block ? "block" : "inline-block", width: block ? "100%" : undefined }}>
      <input
        className="text-input"
        value={value}
        placeholder={placeholder}
        style={{ ...(block ? { width: "100%", boxSizing: "border-box" } : {}), ...inputStyle }}
        onChange={(e) => {
          onChange(e.target.value);
          setActiveIndex(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={onKeyDown}
      />
      {focused && (
        <Menu items={suggestions} activeIndex={activeIndex} setActiveIndex={setActiveIndex} onPick={pick} renderItem={(o) => o} />
      )}
    </div>
  );
}

// Multi-value combobox rendered as a labelled filter row with removable chips.
// `value` is the current list; `onChange` reports the new list. When `allowNew`
// is set, the typed term can be added even if it isn't in `options`.
export function MultiCombobox({
  label,
  options,
  value,
  onChange,
  placeholder = "Add…",
  allowNew = false,
  width = 240,
}: {
  label: string;
  options: string[] | undefined;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  allowNew?: boolean;
  width?: number;
}) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Existing-option suggestions plus, when allowNew and the typed term is new, an
  // "Add" entry. Each option carries an isNew flag for its label.
  const suggestions = useMemo(() => {
    const pool = (options ?? []).filter((n) => !value.includes(n));
    const q = input.trim();
    const matched = q ? pool.filter((n) => n.toLowerCase().includes(q.toLowerCase())) : pool;
    const list = matched.slice(0, 12).map((name) => ({ name, isNew: false }));
    if (
      allowNew &&
      q &&
      !(options ?? []).some((n) => n.toLowerCase() === q.toLowerCase()) &&
      !value.some((n) => n.toLowerCase() === q.toLowerCase())
    ) {
      list.push({ name: q, isNew: true });
    }
    return list;
  }, [input, options, value, allowNew]);

  function add(name: string) {
    const trimmed = name.trim();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setInput("");
    setActiveIndex(0);
  }

  const onKeyDown = useArrowKeys(suggestions.length, setActiveIndex, (e) => {
    if (suggestions.length > 0) {
      e.preventDefault();
      add(suggestions[Math.min(activeIndex, suggestions.length - 1)].name);
    } else if (allowNew && input.trim()) {
      e.preventDefault();
      add(input);
    }
  });

  return (
    <div>
      <div className="filter-row" style={{ alignItems: "flex-start" }}>
        <span className="filter-label">{label}</span>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            className="text-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setActiveIndex(0);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            style={{ width }}
          />
          {focused && (
            <Menu
              items={suggestions}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
              onPick={(o) => add(o.name)}
              renderItem={(o) => (o.isNew ? `Add new: "${o.name}"` : o.name)}
              emptyText={allowNew ? undefined : "No matches"}
              width={width}
            />
          )}
        </div>
      </div>
      {value.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem", marginLeft: 84 }}>
          {value.map((c) => (
            <span key={c} className="chip">
              {c}{" "}
              <button className="chip-remove" onClick={() => onChange(value.filter((x) => x !== c))}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
