// ABOUTME: Brand logo component — the [—] bracket mark, inline SVG.
// ABOUTME: Renders at any size, inherits theme colors via currentColor.

interface RedactaLogoProps {
  size?: number;
  className?: string;
}

/** The Redacta bracket mark: [ — ] with a coral-red redaction dash. */
export function RedactaLogo({ size = 24, className }: RedactaLogoProps) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} aria-hidden="true">
      <rect width="512" height="512" rx="96" fill="currentColor" opacity="0.08" />
      <g fill="currentColor">
        <rect x="100" y="112" width="56" height="288" rx="6" />
        <rect x="100" y="112" width="100" height="52" rx="6" />
        <rect x="100" y="348" width="100" height="52" rx="6" />
        <rect x="356" y="112" width="56" height="288" rx="6" />
        <rect x="312" y="112" width="100" height="52" rx="6" />
        <rect x="312" y="348" width="100" height="52" rx="6" />
      </g>
      <rect x="172" y="228" width="168" height="56" rx="8" fill="var(--color-redact)" />
    </svg>
  );
}
