// ABOUTME: Predefined redaction instruction presets for common PII categories and regulatory frameworks.
// ABOUTME: Each preset provides a prompt template and a thoroughness flag for system prompt behaviour.

export interface RedactionPreset {
  /** Unique identifier */
  id: string;
  /** Short display label for the chip button */
  label: string;
  /** Brief description shown on hover/tooltip */
  description: string;
  /** The prompt text that fills the textarea */
  prompt: string;
  /** When true, switches the system prompt from conservative to thorough mode */
  thorough: boolean;
}

export const REDACTION_PRESETS: RedactionPreset[] = [
  {
    id: "all-pii",
    label: "All PII",
    description: "Comprehensive detection of all personally identifiable information",
    prompt:
      "Redact all personally identifiable information (PII). Apply broad, expert-level judgment to identify: names, contact details, government IDs, financial identifiers, dates tied to individuals (birth, death, appointments), biometric or health data, digital identifiers, employment details, and any other information that could directly or indirectly identify a specific person. This list is illustrative, not exhaustive. If in doubt, redact.",
    thorough: true,
  },
  {
    id: "gdpr",
    label: "GDPR",
    description: "Personal data as defined under GDPR Articles 4 and 9",
    prompt:
      "Redact all personal data as defined under GDPR Article 4: any information relating to an identified or identifiable natural person. This includes names, identification numbers, location data, online identifiers, and factors specific to physical, physiological, genetic, mental, economic, cultural, or social identity. Pay special attention to special category data under Article 9: racial or ethnic origin, political opinions, religious or philosophical beliefs, trade union membership, health data, sex life, sexual orientation, and biometric data. If in doubt, redact.",
    thorough: true,
  },
  {
    id: "financial",
    label: "Financial",
    description: "Bank accounts, cards, tax IDs, and monetary figures",
    prompt:
      "Redact all financial and monetary information: bank account numbers, IBAN, SWIFT/BIC codes, credit and debit card numbers, routing numbers, tax identification numbers, invoice amounts, salary and compensation figures, transaction details, loan references, and any other financial identifiers or account references.",
    thorough: false,
  },
  {
    id: "medical",
    label: "Medical",
    description: "Protected health information as defined under HIPAA",
    prompt:
      "Redact all protected health information (PHI) as defined under HIPAA: patient names, dates (birth, admission, discharge, death), contact details, Social Security numbers, medical record numbers, health plan beneficiary numbers, device identifiers, diagnostic and procedure codes, provider names, prescription details, lab results, and any clinical notes that could identify a patient. If in doubt, redact.",
    thorough: true,
  },
  {
    id: "legal",
    label: "Legal",
    description: "Party names, case numbers, and identifiers in legal proceedings",
    prompt:
      "Redact information identifying parties in legal proceedings: names of plaintiffs, defendants, witnesses, judges, and attorneys; case and docket numbers; addresses, phone numbers, and contact details; financial amounts and settlement figures; dates of birth and personal identifiers; signatures and notary details.",
    thorough: false,
  },
  {
    id: "contact",
    label: "Contact Info",
    description: "Names, emails, phone numbers, addresses, and social handles",
    prompt:
      "Redact all contact and identifying information: full names, email addresses, phone and fax numbers, physical and mailing addresses, postal codes, and social media handles or profile URLs.",
    thorough: false,
  },
];

export function getPresetById(id: string): RedactionPreset | undefined {
  return REDACTION_PRESETS.find((p) => p.id === id);
}
