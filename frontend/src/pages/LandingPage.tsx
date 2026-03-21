// ABOUTME: Full-screen landing page with interactive PixelTrail hero and inline PDF upload.
// ABOUTME: Centered hero content with branding, value prop, feature pills, and drop zone CTA.

import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Eye, FileText, ImageOff, Shield, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useLocation } from "wouter";
import { useScreenSize } from "../components/hooks/use-screen-size";
import { RedactaLogo } from "../components/RedactaLogo";
import { PixelTrail } from "../components/ui/pixel-trail";
import { storePdf } from "../lib/pdf-store";

function FeaturePill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/60 border border-border-subtle text-xs text-text-sub">
      <Icon className="w-3.5 h-3.5 text-text-dim" />
      <span>{label}</span>
    </div>
  );
}

export function LandingPage() {
  const [, navigate] = useLocation();
  const screenSize = useScreenSize();

  const handleFileAccepted = useCallback(
    async (file: File) => {
      await storePdf(file);
      navigate("/workspace");
    },
    [navigate],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        handleFileAccepted(file);
      }
    },
    [handleFileAccepted],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    multiple: false,
  });

  return (
    <motion.div
      key="landing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex flex-col"
    >
      <section className="relative flex-1 flex items-center justify-center overflow-hidden">
        {/* PixelTrail background */}
        <div className="absolute inset-0 z-0">
          <PixelTrail
            pixelSize={screenSize.lessThan("md") ? 48 : 80}
            fadeDuration={0}
            delay={1200}
            pixelClassName="rounded-full bg-redact/40"
          />
        </div>

        {/* Vignette for text readability */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--color-bg)_85%)] z-1 pointer-events-none" />

        {/* Trust marquee at bottom */}
        <div className="absolute bottom-0 left-0 right-0 z-10 overflow-hidden border-t border-border-subtle/60 bg-bg/50 backdrop-blur-md pointer-events-none">
          <div className="trust-marquee flex whitespace-nowrap py-3">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="flex shrink-0 items-center gap-8 px-4 text-xs font-medium tracking-wide text-text-dim uppercase"
              >
                <span>No Signup Required</span>
                <span className="text-border">✦</span>
                <span>No Watermarks</span>
                <span className="text-border">✦</span>
                <span>Free &amp; Open Source</span>
                <span className="text-border">✦</span>
                <span>GDPR Compliant</span>
                <span className="text-border">✦</span>
                <span>HIPAA Compliant</span>
                <span className="text-border">✦</span>
                <span>CCPA / CPRA</span>
                <span className="text-border">✦</span>
                <span>No Subscriptions</span>
                <span className="text-border">✦</span>
                <span>Permanent Redaction</span>
                <span className="text-border">✦</span>
                <span>No Software Installation</span>
                <span className="text-border">✦</span>
                <span>Zero Data Retention</span>
                <span className="text-border">✦</span>
                <span>Works Offline After Load</span>
                <span className="text-border">✦</span>
                <span>No File Size Limits</span>
                <span className="text-border">✦</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-xl px-8 pointer-events-none">
          <div className="stagger-1 mb-6">
            <RedactaLogo size={48} className="text-text" />
          </div>

          {/* Frosted glass card */}
          <div className="rounded-2xl border border-border-subtle/60 bg-bg/40 backdrop-blur-xl shadow-lg p-6 md:p-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-text tracking-tight leading-tight mb-4 stagger-1">
              AI-Powered
              <br />
              <span className="text-redact">Document Redaction</span>
            </h1>

            <p className="text-base md:text-lg text-text-sub leading-relaxed mb-8 stagger-2">
              Describe what to remove. AI identifies and{" "}
              <span className="text-redact font-medium">redacts</span> or{" "}
              <span className="text-pseudo font-medium">pseudonymises</span> matching text and
              images, entirely in your browser.{" "}
              <span className="text-text">Bring your own API key</span>, your data never leaves your
              device.
            </p>

            <div className="flex flex-wrap gap-3 mb-8 stagger-3">
              <FeaturePill icon={Shield} label="Client-side only" />
              <FeaturePill icon={Sparkles} label="AI-powered" />
              <FeaturePill icon={FileText} label="Preserves structure" />
              <FeaturePill icon={Eye} label="Pseudonymisation" />
              <FeaturePill icon={ImageOff} label="Image redaction" />
            </div>

            {/* Drop zone */}
            <div {...getRootProps()} className="stagger-4 pointer-events-auto">
              <input {...getInputProps()} />
              <div
                className={`
                  group flex items-center justify-between
                  px-5 py-4 rounded-xl border cursor-pointer
                  transition-all duration-200
                  ${
                    isDragActive
                      ? "border-redact bg-redact-soft"
                      : "border-border hover:border-text-dim bg-raised/60 hover:bg-surface/60"
                  }
                `}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`
                      flex items-center justify-center w-10 h-10 rounded-lg transition-colors
                      ${isDragActive ? "bg-redact-soft" : "bg-surface/60"}
                    `}
                  >
                    <FileText
                      className={`w-5 h-5 transition-colors ${isDragActive ? "text-redact" : "text-text-dim group-hover:text-text-sub"}`}
                    />
                  </div>
                  <div>
                    <p
                      className={`text-sm font-medium transition-colors ${isDragActive ? "text-redact" : "text-text"}`}
                    >
                      {isDragActive ? "Release to upload" : "Drop a PDF here"}
                    </p>
                    <p className="text-xs text-text-dim mt-0.5">or click to browse</p>
                  </div>
                </div>

                <ArrowUpRight
                  className={`
                    w-4.5 h-4.5 transition-all duration-200
                    ${isDragActive ? "text-redact" : "text-text-faint group-hover:text-text-dim group-hover:-translate-y-0.5 group-hover:translate-x-0.5"}
                  `}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
