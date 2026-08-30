import { describe, expect, it } from "vitest";

import { assessOfficial005409Fidelity } from "./official-005-409-fidelity";

describe("assessOfficial005409Fidelity", () => {
  it("blocks official output when no approved source revision is registered", () => {
    expect(
      assessOfficial005409Fidelity({
        sourceRevision: null,
        sourceSha256: null,
        fieldMapApproved: false,
        renderedFidelityApproved: false,
      }),
    ).toEqual({
      ready: false,
      blockers: [
        "approved_source_revision",
        "source_sha256",
        "approved_field_map",
        "rendered_fidelity",
      ],
    });
  });

  it("does not treat narrative/example material as an approved official source", () => {
    expect(
      assessOfficial005409Fidelity({
        sourceRevision: "005 templet.docx / 2026-07-18",
        sourceSha256: "a".repeat(64),
        sourceKind: "example_material",
        fieldMapApproved: true,
        renderedFidelityApproved: true,
      }),
    ).toEqual({ ready: false, blockers: ["authoritative_source_kind"] });
  });

  it("allows the official-output path only after every fidelity gate is satisfied", () => {
    expect(
      assessOfficial005409Fidelity({
        sourceRevision: "ADC 005/409 rev 2026-08",
        sourceSha256: "b".repeat(64),
        sourceKind: "authoritative_form",
        fieldMapApproved: true,
        renderedFidelityApproved: true,
      }),
    ).toEqual({ ready: true, blockers: [] });
  });
});
