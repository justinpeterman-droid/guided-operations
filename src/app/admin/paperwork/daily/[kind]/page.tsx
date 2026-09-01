import Link from "next/link";

import { AdminShell } from "@/app/components/admin-shell";
import {
  AdminAccessRequiredMessage,
  AdminUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { WorkspaceMessage } from "@/app/components/workspace-message";
import {
  dailyPaperworkKindSchema,
  shiftCodeSchema,
} from "@/features/daily-paperwork/catalog";
import { DailyPaperworkWorkspace } from "@/features/daily-paperwork/daily-paperwork-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDailyPaperworkForCurrentSession } from "@/server/paperwork/get-daily-paperwork";

export const metadata = {
  title: "Daily paperwork record",
};

export const dynamic = "force-dynamic";

export default async function DailyPaperworkFormPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const [{ kind: kindCandidate }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const kind = dailyPaperworkKindSchema.safeParse(kindCandidate);
  const workDate = single(query.workDate);
  const shiftCode = shiftCodeSchema.safeParse(single(query.shiftCode));
  if (!kind.success || !zonedDate(workDate) || !shiftCode.success)
    return (
      <WorkspaceMessage
        actions={[
          {
            href: "/admin/paperwork/daily",
            label: "Return to Daily Paperwork",
          },
        ]}
        description="No paperwork was changed."
        eyebrow="Daily Paperwork"
        title="That form selection is not valid."
        variant="admin"
      />
    );

  const client = await createSupabaseServerClient();
  const result = await getDailyPaperworkForCurrentSession(
    { kind: kind.data, workDate, shiftCode: shiftCode.data },
    client,
  );
  if (result.kind !== "found") {
    if (result.kind === "denied") {
      return (
        <AdminAccessRequiredMessage description="No paperwork was changed." />
      );
    }
    return (
      <AdminUnavailableMessage
        description="No paperwork was changed."
        eyebrow="Daily Paperwork"
        title={
          result.kind === "not_configured"
            ? "This approved form has not been loaded yet."
            : "The form cannot load right now."
        }
      />
    );
  }

  return (
    <AdminShell
      actions={
        <Link
          className="reports-home-link"
          href={`/admin/paperwork/daily?workDate=${encodeURIComponent(workDate)}&shiftCode=${shiftCode.data}`}
        >
          All Daily Paperwork
        </Link>
      }
      className="reports-page daily-paperwork-page"
      title="Daily Paperwork"
    >
      <DailyPaperworkWorkspace initialPaperwork={result.paperwork} />
    </AdminShell>
  );
}

function single(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function zonedDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}
