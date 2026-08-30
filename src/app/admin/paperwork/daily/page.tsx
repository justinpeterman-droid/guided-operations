import Link from "next/link";

import { DailyPaperworkCatalog } from "@/features/daily-paperwork/daily-paperwork-catalog";
import type { ShiftCode } from "@/features/daily-paperwork/catalog";
import { resolveDailyPaperworkSelection } from "@/features/daily-paperwork/selection";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listDailyPaperworkStatusForCurrentSession } from "@/server/paperwork/list-daily-paperwork-status";

export const dynamic = "force-dynamic";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DailyPaperworkPage({
  searchParams,
}: Readonly<{ searchParams: PageSearchParams }>) {
  const selection = resolveDailyPaperworkSelection(
    await searchParams,
    centralWorkDate(),
  );
  if (!selection) return <InvalidSelection />;

  const result = await loadDailyPaperworkStatus(selection);
  if (result.kind === "denied") return <AccessRequired />;
  if (result.kind === "unavailable") return <Unavailable />;

  return (
    <DailyPaperworkCatalog
      canManagePackages={getRuntimeEnvironment().APP_ENV === "production"}
      forms={result.forms}
      shiftCode={selection.shiftCode}
      workDate={selection.workDate}
    />
  );
}

export async function loadDailyPaperworkStatus(
  selection: Readonly<{
    workDate: string;
    shiftCode: ShiftCode;
  }>,
) {
  try {
    const client = await createSupabaseServerClient();
    return await listDailyPaperworkStatusForCurrentSession(selection, client);
  } catch {
    return { kind: "unavailable" } as const;
  }
}

function centralWorkDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Chicago",
    year: "numeric",
  }).format(new Date());
}

function AccessRequired() {
  return (
    <MessagePage
      eyebrow="Private workspace"
      title="Administrator access is required."
      copy="Daily Paperwork is available only to a current administrator account."
      href="/home"
      action="Return to your workspace"
    />
  );
}

function InvalidSelection() {
  return (
    <MessagePage
      eyebrow="Date or shift not recognized"
      title="Choose a valid Daily Paperwork work period."
      copy="No paperwork was opened or changed."
      href="/admin/paperwork/daily"
      action="Use today's date and shift A"
    />
  );
}

function Unavailable() {
  return (
    <MessagePage
      eyebrow="Daily Paperwork unavailable"
      title="The Daily Paperwork list cannot load right now."
      copy="No existing paperwork has been changed."
      href="/admin"
      action="Return to administrator workspace"
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
        aria-labelledby="daily-message-title"
      >
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="daily-message-title">{title}</h1>
        <p>{copy}</p>
        <Link className="reports-home-link" href={href}>
          {action}
        </Link>
      </section>
    </main>
  );
}
