export const WORKSPACE_NAV_ITEMS = [
  ["Home", "/home", "Home"],
  ["Report Assistant", "/incidents/new", "Report Assistant"],
  ["Policy", "/policy-expert", "Policy Expert"],
  ["Reports", "/reports", "Reports & History"],
  ["Count Sheet", "/count-sheet", "Count Sheet"],
  ["Forms", "/forms", "Forms"],
  ["Account", "/account", "Account"],
] as const;

export type WorkspaceNavLabel = (typeof WORKSPACE_NAV_ITEMS)[number][0];

export const PREVIEW_NAV_ROUTES: Partial<Record<WorkspaceNavLabel, string>> = {
  Home: "/preview/workspace",
  "Report Assistant": "/preview/report-assistant",
  Policy: "/preview/policy-expert",
  "Count Sheet": "/preview/count-sheet",
  Forms: "/preview/forms-library",
};
