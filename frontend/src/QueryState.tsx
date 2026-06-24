// Tiny shared status lines so loading/error/empty states read the same everywhere.

export function Loading() {
  return <p>Loading…</p>;
}

export function ErrorText({ message }: { message: string }) {
  return <p className="error-text">{message}</p>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "#666" }}>{children}</p>;
}
