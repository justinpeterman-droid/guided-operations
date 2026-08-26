import Link from "next/link";

const items = [
  ["Home", "/home"],
  ["Reports", "/reports"],
  ["Policy", "/policy-expert"],
  ["Forms", "/preview/forms-library"],
  ["Account", "/account"],
] as const;

/** Shared plain-language navigation for normal officer pages. */
export function WorkspaceNavigation({
  current,
}: Readonly<{ current?: string }>) {
  return (
    <nav aria-label="Workspace" className="workspace-navigation">
      {items.map(([label, href]) => (
        <Link
          aria-current={current === label ? "page" : undefined}
          href={href}
          key={href}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
