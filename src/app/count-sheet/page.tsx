import Link from "next/link";

import { WorkspaceShell } from "@/app/components/workspace-shell";
import { CountSheetWorkspace } from "@/features/count-sheet/count-sheet-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";

export const dynamic = "force-dynamic";

export default async function CountSheetPage() {
  const access = await loadAccess();
  if (access.kind === "denied") return <SignInRequired />;
  if (access.kind === "unavailable") return <Unavailable />;
  if (access.kind === "unassigned") return <ShiftRequired />;

  return (
    <WorkspaceShell current="Count Sheet" title="Count Sheet">
      <CountSheetWorkspace
        initialWorkDate={centralWorkDate()}
        shiftCode={access.shiftCode}
      />
    </WorkspaceShell>
  );
}

function centralWorkDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Chicago",
    year: "numeric",
  }).format(new Date());
}

async function loadAccess() {
  try {
    const session = await authorizeCurrentSession(
      await createSupabaseServerClient(),
    );
    if (!session.allowed) return { kind: "denied" } as const;
    if (!session.account.shiftCode) return { kind: "unassigned" } as const;
    return {
      kind: "authorized" as const,
      shiftCode: session.account.shiftCode,
    };
  } catch {
    return { kind: "unavailable" } as const;
  }
}

function SignInRequired() {
  return (
    <MessagePage
      eyebrow="Private workspace"
      title="Sign in to use the Count Sheet."
      copy="Count Sheets are available only after the app verifies your current account."
      href="/login"
      action="Sign in"
    />
  );
}

function ShiftRequired() {
  return (
    <MessagePage
      eyebrow="Shift assignment needed"
      title="Your Count Sheet cannot open yet."
      copy="An administrator must assign your account to shift A, B, C, D, U, or F before you can use the shared shift sheet."
      href="/home"
      action="Return home"
    />
  );
}

function Unavailable() {
  return (
    <MessagePage
      eyebrow="Count Sheet unavailable"
      title="The Count Sheet cannot be loaded right now."
      copy="No Count Sheet work has been changed. Please try again later."
      href="/home"
      action="Return home"
    />
  );
}

function MessagePage({
  eyebrow,
  title,
  copy,
  href,
  action,
}: Readonly<{
  eyebrow: string;
  title: string;
  copy: string;
  href: string;
  action: string;
}>) {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="count-sheet-message-title"
      >
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="count-sheet-message-title">{title}</h1>
        <p>{copy}</p>
        <Link className="reports-home-link" href={href}>
          {action}
        </Link>
      </section>
    </main>
  );
}
