import { useId } from "react";

// ECG-pulse mark: rose gradient circle + heartbeat trace.
// Control size with className (e.g. "h-14 w-14"). Defaults to 56px.
export function AppMark({ className = "h-14 w-14" }: { className?: string }) {
  const rawId = useId();
  const id = `mark-${rawId.replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        <radialGradient id={id} cx="22" cy="14" r="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5eead4" />
          <stop offset="0.4" stopColor="#0d9488" />
          <stop offset="1" stopColor="#134e4a" />
        </radialGradient>
      </defs>
      <circle cx="28" cy="28" r="28" fill={`url(#${id})`} />
      <path
        d="M8 28H14L16 25L18 28L20 32L23 13L26 35L28 28L32 22L36 28H48"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.93"
      />
    </svg>
  );
}
