// A simplified stand-in for the Urban Task Force skyline mark, built from
// the shared logo image rather than the original vector file. Swap this
// for the real asset (e.g. an <img src="/logo-mark.svg" />) if/when it's
// available in the project.
export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 20V9.5L6 7l3 2.5V20" />
      <path d="M9 20V6h6v14" />
      <path d="M15 20V10l3-3 3 3v10" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}
