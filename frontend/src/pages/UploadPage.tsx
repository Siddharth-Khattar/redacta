// ABOUTME: Landing page with the PDF upload drop-zone.
// ABOUTME: Stores the uploaded file in IndexedDB and navigates to the workspace route.

import { motion } from "motion/react";
import { useCallback } from "react";
import { useLocation } from "wouter";
import { UploadZone } from "../components/UploadZone";
import { storePdf } from "../lib/pdf-store";

export function UploadPage() {
  const [, navigate] = useLocation();

  const handleFileAccepted = useCallback(
    async (file: File) => {
      await storePdf(file);
      navigate("/workspace");
    },
    [navigate],
  );

  return (
    <motion.div
      key="upload"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex flex-col"
    >
      <UploadZone onFileAccepted={handleFileAccepted} />
    </motion.div>
  );
}
