import { Link } from "react-router-dom";

// Renders an archetype name as a link to its archetype page, or plain "Unknown"
// text when the archetype is null. Shared by the player record tables.
export function ArchetypeLink({ archetype }: { archetype: string | null }) {
  if (!archetype) return <>Unknown</>;
  return <Link to={`/archetypes/${encodeURIComponent(archetype)}`}>{archetype}</Link>;
}
