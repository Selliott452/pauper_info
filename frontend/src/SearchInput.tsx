// A text input wrapped with a leading search icon and a trailing clear (×)
// button that appears once there's a value. Used across filter panels so the
// search affordance is consistent.
export function SearchInput({
  value,
  onChange,
  placeholder,
  width,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number | string;
  ariaLabel?: string;
}) {
  return (
    <span className="search-input" style={width != null ? { width } : undefined}>
      <svg className="search-input-icon" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        className="search-input-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
      />
      {value && (
        <button
          type="button"
          className="search-input-clear"
          onClick={() => onChange("")}
          aria-label="Clear"
          title="Clear"
        >
          ×
        </button>
      )}
    </span>
  );
}
