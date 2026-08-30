import type { CountSheetStructure } from "./types";

/**
 * Approved Count Sheet structure recovered from the reviewed legacy source.
 * Values are operational data and are never stored in this source file.
 */
export const APPROVED_COUNT_SHEET_STRUCTURE: CountSheetStructure = {
  schema_version: 1,
  title: "North Central Unit Count Sheet",
  columns: [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "13",
    "14",
    "Iso",
    "Inf",
  ],
  areas: [
    "A/W Office",
    "Barber Shop I/M",
    "Boiler Room",
    "Bull Pen",
    "Capt. Office",
    "Chapel",
    "Chow Hall",
    "Commissary",
    "Construction",
    "Dog Kennel",
    "Domestics",
    "Field Utility",
    "Front Office",
    "Garage",
    "Gate Pass",
    "Gym",
    "Hall Porter",
    "Horsebarn",
    "I.P.O.",
    "Infirmary",
    "Iso. Porter",
    "Kitchen",
    "Laundry",
    "Lawn, Inside",
    "Library / Law Library",
    "Maint. Inside",
    "Maint. Outside",
    "Major's Office",
    "Mental Health",
    "Mt. Home Crew",
    "Other",
    "Reg. Maint #1",
    "Reg. Maint #2",
    "Sally Port",
    "School",
    "Trail Crew",
    "Visitation",
    "W.W.T.P.",
    "Work Craft",
    "Yard (North)",
    "Yard (South)",
  ],
  operational_fields: [
    "on_site",
    "gate_pass",
    "transfers",
    "court",
    "hospital",
    "furlough",
    "other",
  ],
  attachment_reminders: ["court", "hospital", "furlough"],
};

export function isApprovedCountSheetStructure(
  structure: CountSheetStructure,
): boolean {
  return (
    JSON.stringify(structure) === JSON.stringify(APPROVED_COUNT_SHEET_STRUCTURE)
  );
}
