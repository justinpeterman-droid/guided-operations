export const WORKSPACE_NAV_ITEMS = [
  ["Home", "/home"],
  ["Reports", "/reports"],
  ["Policy", "/policy-expert"],
  ["Count Sheet", "/count-sheet"],
  ["Forms", "/forms"],
  ["Account", "/account"],
] as const;

export type WorkspaceNavLabel = (typeof WORKSPACE_NAV_ITEMS)[number][0];
