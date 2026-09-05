"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const destinations = [
  ["/admin", "Overview"],
  ["/admin/accounts", "Accounts"],
  ["/admin/paperwork/daily", "Daily paperwork"],
  ["/admin/improvements", "Suggestions"],
  ["/admin/audit", "Activity"],
  ["/admin/health", "Health"],
  ["/admin/retention", "Records controls"],
] as const;

/** Destination links only; each page still authorizes its own reads and actions. */
export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav className="go-ui admin-navigation" aria-label="Administration">
      <span className="admin-navigation-label">Administration</span>
      <div>
        {destinations.map(([href, label]) => {
          const current =
            pathname === href ||
            (href !== "/admin" && pathname?.startsWith(`${href}/`));
          return (
            <Button
              key={href}
              asChild
              variant={current ? "secondary" : "ghost"}
            >
              <Link
                href={href}
                prefetch={false}
                aria-current={current ? "page" : undefined}
              >
                {label}
              </Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
