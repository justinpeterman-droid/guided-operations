export type DocumentStudioTabId =
  | "overview"
  | "officer-reports"
  | "copy-to-records"
  | "required-paperwork"
  | "notes-facts"
  | "history";

export const DOCUMENT_STUDIO_TABS = [
  {
    id: "overview",
    label: "Overview",
    description: "Incident and packet state",
  },
  {
    id: "officer-reports",
    label: "Officer Reports",
    description: "Attributed drafts and finalized reports",
  },
  {
    id: "copy-to-records",
    label: "Copy to Records",
    description: "Plain copy-only text",
  },
  {
    id: "required-paperwork",
    label: "Required Paperwork",
    description: "Required, suggested, and physical-only items",
  },
  {
    id: "notes-facts",
    label: "Notes & Facts",
    description: "Reviewed facts from the current revision",
  },
  {
    id: "history",
    label: "History",
    description: "Revision and report history",
  },
] as const satisfies ReadonlyArray<{
  id: DocumentStudioTabId;
  label: string;
  description: string;
}>;

export type DocumentStudioFormCapability =
  "available_in_reports" | "physical_only" | "not_yet_available";

export type DocumentStudioFormCatalogEntry = Readonly<{
  label: string;
  capability: DocumentStudioFormCapability;
  detail: string;
}>;

/** Known required-form keys mapped to honest capability labels for Document Studio. */
export const DOCUMENT_STUDIO_FORM_CATALOG: Record<
  string,
  DocumentStudioFormCatalogEntry
> = {
  cover_letter: {
    label: "Cover letter",
    capability: "available_in_reports",
    detail: "Create and finalize through Officer Reports.",
  },
  first_person: {
    label: "First-person report",
    capability: "available_in_reports",
    detail: "Create and finalize through Officer Reports.",
  },
  supervisor_summary: {
    label: "Supervisor summary",
    capability: "available_in_reports",
    detail: "Create and finalize through Officer Reports.",
  },
  disciplinary: {
    label: "Disciplinary report",
    capability: "available_in_reports",
    detail: "Create and finalize through Officer Reports.",
  },
  "005_409": {
    label: "005 / 409 designation",
    capability: "not_yet_available",
    detail: "Official source-form output is still under fidelity review.",
  },
  major_disciplinary_form: {
    label: "Major disciplinary form",
    capability: "not_yet_available",
    detail: "Digital mapping and print fidelity are not yet approved.",
  },
  photo_video: {
    label: "Photo / video log",
    capability: "not_yet_available",
    detail: "Digital mapping and print fidelity are not yet approved.",
  },
  chain_of_custody: {
    label: "Chain of Custody",
    capability: "physical_only",
    detail: "Obtain and complete the official paper form by hand.",
  },
  weapon_chain_of_custody_f401: {
    label: "Weapon chain of custody (F-401)",
    capability: "physical_only",
    detail: "Obtain and complete the official paper form by hand.",
  },
  confiscation_f401: {
    label: "Confiscation (F-401)",
    capability: "not_yet_available",
    detail: "Digital mapping and print fidelity are not yet approved.",
  },
  field_test_result: {
    label: "Field test result",
    capability: "not_yet_available",
    detail: "Digital mapping and print fidelity are not yet approved.",
  },
  medical_report: {
    label: "Medical report",
    capability: "not_yet_available",
    detail: "Digital mapping and print fidelity are not yet approved.",
  },
  inmate_drug_test: {
    label: "Inmate drug test",
    capability: "not_yet_available",
    detail: "Digital mapping and print fidelity are not yet approved.",
  },
  money_receipt_business_office: {
    label: "Business Office money receipt",
    capability: "not_yet_available",
    detail: "Digital mapping and print fidelity are not yet approved.",
  },
  use_of_force_report_409: {
    label: "Use-of-force report (409)",
    capability: "not_yet_available",
    detail: "Official source-form output is still under fidelity review.",
  },
};

export function describeDocumentStudioForm(
  formKey: string,
): DocumentStudioFormCatalogEntry {
  return (
    DOCUMENT_STUDIO_FORM_CATALOG[formKey] ?? {
      label: formKey.replaceAll("_", " "),
      capability: "not_yet_available",
      detail: "This paperwork item is not yet approved for digital work here.",
    }
  );
}
