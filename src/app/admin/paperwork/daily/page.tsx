import {
  AdminAccessRequiredMessage,
  AdminUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { WorkspaceMessage } from "@/app/components/workspace-message";
import { DailyPaperworkCatalog } from "@/features/daily-paperwork/daily-paperwork-catalog";
import type { ShiftCode } from "@/features/daily-paperwork/catalog";
import { resolveDailyPaperworkSelection } from "@/features/daily-paperwork/selection";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listDailyPaperworkStatusForCurrentSession } from "@/server/paperwork/list-daily-paperwork-status";

export const metadata = {
  title: "Daily paperwork",
};

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
    <AdminAccessRequiredMessage description="Daily Paperwork is available only to a current administrator account." />
  );
}

function InvalidSelection() {
  return (
    <WorkspaceMessage
      actions={[
        {
          href: "/admin/paperwork/daily",
          label: "Use today's date and shift A",
        },
      ]}
      description="No paperwork was opened or changed."
      eyebrow="Date or shift not recognized"
      title="Choose a valid Daily Paperwork work period."
      variant="admin"
    />
  );
}

function Unavailable() {
  return (
    <AdminUnavailableMessage
      description="No existing paperwork has been changed."
      eyebrow="Daily Paperwork unavailable"
      title="The Daily Paperwork list cannot load right now."
    />
  );
}
