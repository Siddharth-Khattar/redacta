// ABOUTME: Processing state display with pulsing indicator.
// ABOUTME: Clean, calm design during the redaction API call.

import { motion } from "motion/react";
import type { ProcessingMode } from "../api/redaction";

interface ProcessingPanelProps {
  mode: ProcessingMode;
}

export function ProcessingPanel({ mode }: ProcessingPanelProps) {
  const isPseudo = mode === "pseudonymise";

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        {/* Pulsing dot */}
        <motion.div
          className={`w-3 h-3 rounded-full mx-auto mb-6 ${isPseudo ? "bg-pseudo" : "bg-redact"}`}
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />

        <h3 className="text-lg font-semibold text-text mb-1.5">Analyzing document...</h3>
        <p className="text-sm text-text-dim">
          {isPseudo ? "Identifying content to pseudonymise" : "Identifying content to redact"}
        </p>

        {/* Animated dots */}
        <div className="flex justify-center gap-1.5 mt-5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-text-dim"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
