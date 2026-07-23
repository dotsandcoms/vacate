// A small, deterministic colored-initials avatar. Real photos aren't
// available from Kissflow, but a plain text name in every list is one of
// the fastest ways an interface reads as an unfinished template — this is
// a cheap, consistent substitute that still gives each person a visual
// identity across the app.
const palette = [
  "#116152",
  "#0d4f44",
  "#334155",
  "#9a3412",
  "#a16207",
  "#0e7490",
  "#6d28d9",
  "#9f1239",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const sizes = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-[13px]",
  lg: "h-14 w-14 text-lg",
};

export default function Avatar({
  name,
  size = "sm",
}: {
  name: string | undefined;
  size?: keyof typeof sizes;
}) {
  const safeName = name ?? "?";
  const color = palette[hashName(safeName) % palette.length];
  return (
    <span
      className={`inline-flex ${sizes[size]} shrink-0 select-none items-center justify-center rounded-full font-display font-medium text-white`}
      style={{ backgroundColor: color }}
    >
      {initials(safeName)}
    </span>
  );
}
