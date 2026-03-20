// ABOUTME: GPU-composited scanning animation overlay during redaction processing.
// ABOUTME: Sweep driven by framer-motion; warm coral accent glow.

import { motion } from "motion/react";
import { useLayoutEffect, useState } from "react";

const SCAN_PARTICLES: [number, string, string][] = [
  [15, "0s", "1.0s"],
  [35, "0.15s", "1.2s"],
  [55, "0.3s", "0.9s"],
  [75, "0.1s", "1.1s"],
  [90, "0.4s", "1.0s"],
];

interface ScanOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function ScanOverlay({ containerRef }: ScanOverlayProps) {
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    if (containerRef.current) {
      setHeight(containerRef.current.offsetHeight);
    }
  }, [containerRef]);

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      <div className="absolute inset-0 bg-bg/15" />

      {/* Shimmer */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 will-change-transform opacity-[0.06]"
          style={{
            background:
              "linear-gradient(90deg, transparent 25%, rgba(217,83,79,0.5) 50%, transparent 75%)",
            animation: "scan-shimmer 1s ease-in-out infinite",
          }}
        />
      </div>

      {/* Scanning line */}
      {height > 0 && (
        <motion.div
          className="absolute top-0 left-0 right-0 will-change-transform"
          animate={{ y: [0, height - 2, 0] }}
          transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }}
        >
          <div className="h-16 bg-gradient-to-t from-redact/10 to-transparent" />
          <div className="h-[1px] bg-redact shadow-[0_0_20px_4px_rgba(217,83,79,0.3)]" />
        </motion.div>
      )}

      {/* Particles */}
      {SCAN_PARTICLES.map(([left, delay, duration], i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-redact will-change-transform"
          style={{
            left: `${left}%`,
            top: "50%",
            boxShadow: "0 0 6px 2px rgba(217,83,79,0.3)",
            animation: `scan-particle ${duration} ${delay} ease-out infinite`,
          }}
        />
      ))}
    </div>
  );
}
