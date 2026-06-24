import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCardDetail } from "./api";

// A link to a card's page that shows a floating card image while hovered.
// The image is fetched lazily (only on hover) and cached by React Query, so
// re-hovering the same card is instant.
export function CardLink({
  name,
  children,
}: {
  name: string;
  children?: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const { data } = useQuery({
    queryKey: ["card-detail", name],
    queryFn: () => fetchCardDetail(name),
    enabled: hovered,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <>
      <Link
        to={`/cards/${encodeURIComponent(name)}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      >
        {children ?? name}
      </Link>
      {hovered && data?.imageUri && (
        <img
          src={data.imageUri}
          alt={name}
          style={{
            position: "fixed",
            top: Math.min(pos.y + 16, window.innerHeight - 320),
            left: Math.min(pos.x + 16, window.innerWidth - 240),
            width: 220,
            borderRadius: 10,
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            pointerEvents: "none",
            zIndex: 1000,
          }}
        />
      )}
    </>
  );
}
