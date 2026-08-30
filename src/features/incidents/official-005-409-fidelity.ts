export type Official005409SourceKind = "authoritative_form" | "example_material";

export type Official005409FidelityInput = Readonly<{
  sourceRevision: string | null;
  sourceSha256: string | null;
  sourceKind?: Official005409SourceKind;
  fieldMapApproved: boolean;
  renderedFidelityApproved: boolean;
}>;

export type Official005409FidelityBlocker =
  | "approved_source_revision"
  | "source_sha256"
  | "authoritative_source_kind"
  | "approved_field_map"
  | "rendered_fidelity";

export type Official005409FidelityResult = Readonly<{
  ready: boolean;
  blockers: readonly Official005409FidelityBlocker[];
}>;

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

/**
 * Prevents deterministic incident mappings from being represented as an
 * official 005/409 form before the exact authoritative source revision has
 * completed provenance, field-map, and rendered-fidelity review.
 */
export function assessOfficial005409Fidelity(
  input: Official005409FidelityInput,
): Official005409FidelityResult {
  const blockers: Official005409FidelityBlocker[] = [];

  if (!input.sourceRevision?.trim()) {
    blockers.push("approved_source_revision");
  }
  if (!input.sourceSha256 || !SHA256_PATTERN.test(input.sourceSha256)) {
    blockers.push("source_sha256");
  }
  if (input.sourceKind && input.sourceKind !== "authoritative_form") {
    blockers.push("authoritative_source_kind");
  }
  if (!input.fieldMapApproved) {
    blockers.push("approved_field_map");
  }
  if (!input.renderedFidelityApproved) {
    blockers.push("rendered_fidelity");
  }

  return { ready: blockers.length === 0, blockers };
}
