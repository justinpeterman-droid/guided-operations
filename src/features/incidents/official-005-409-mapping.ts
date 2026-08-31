export type Official005409MappingInput = Readonly<{
  category: string;
  occurredAt: string;
  location: string;
}>;

export type Official005409Mapping = Readonly<{
  designations: Readonly<{
    form005: "X";
    form409: "X" | "";
  }>;
  approximateTime: string;
  presence: "Same as above";
  location: string;
}>;

const OFFSET_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function formatApproximateTime(occurredAt: string): string {
  const match = OFFSET_TIMESTAMP_PATTERN.exec(occurredAt);
  if (!match) {
    throw new Error("occurredAt must include an explicit timezone offset");
  }

  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour24 > 23 || minute > 59) {
    throw new Error("occurredAt must include an explicit timezone offset");
  }

  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  return `APX. ${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

/**
 * Builds only the deterministic fields whose mapping is already approved.
 * Final 005/409 source-form layout and rendering remain a separate fidelity gate.
 */
export function buildOfficial005409Mapping(
  input: Official005409MappingInput,
): Official005409Mapping {
  return {
    designations: {
      form005: "X",
      form409: input.category === "use_of_force" ? "X" : "",
    },
    approximateTime: formatApproximateTime(input.occurredAt),
    presence: "Same as above",
    location: input.location,
  };
}
