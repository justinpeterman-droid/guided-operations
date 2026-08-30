export const countSheetCapabilities = [
  "Open and edit",
  "Saved revision history",
  "Audited browser print",
] as const;

export const dailyPaperworkCapabilities = [
  "Administrator only",
  "Six-form protected workspace",
  "Approved sources required",
] as const;

export const chainOfCustodyGuidance = {
  title: "Chain of Custody",
  description:
    "Obtain the official carbon-copy form from the approved facility source and complete it by hand.",
  capabilities: [
    "Physical form only",
    "Hand-completed",
    "No digital substitute",
  ],
} as const;

export const unavailableForms = [
  {
    title: "Monthly packets",
    description:
      "Packet contents, source versions, print layout, and records rules still require approval.",
  },
] as const;
