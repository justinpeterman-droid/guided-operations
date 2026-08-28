import Link from "next/link";

import { WorkspaceNavigation } from "@/app/components/workspace-navigation";
import {
  dailyPaperworkKindSchema,
  shiftCodeSchema,
} from "@/features/daily-paperwork/catalog";
import { DailyPaperworkWorkspace } from "@/features/daily-paperwork/daily-paperwork-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDailyPaperworkForCurrentSession } from "@/server/paperwork/get-daily-paperwork";

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
    return <Message title="That form selection is not valid." />;

  const client = await createSupabaseServerClient();
  const result = await getDailyPaperworkForCurrentSession(
    { kind: kind.data, workDate, shiftCode: shiftCode.data },
    client,
  );
  if (result.kind !== "found")
    return (
      <Message
        title={
          result.kind === "denied"
            ? "Administrator access is required."
            : result.kind === "not_configured"
              ? "This approved form has not been loaded yet."
              : "The form cannot load right now."
        }
      />
    );

  return (
    <main className="reports-page daily-paperwork-page">
      <header className="workspace-header reports-header">
        <Link className="workspace-brand" href="/admin">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Daily Paperwork</strong>
          </span>
        </Link>
        <div className="reports-header-actions">
          <WorkspaceNavigation current="Home" />
          <Link
            className="reports-home-link"
            href={`/admin/paperwork/daily?workDate=${encodeURIComponent(workDate)}&shiftCode=${shiftCode.data}`}
          >
            All Daily Paperwork
          </Link>
        </div>
      </header>
      <DailyPaperworkWorkspace initialPaperwork={result.paperwork} />
    </main>
  );
}

function Message({ title }: Readonly<{ title: string }>) {
  return (
    <main className="reports-page reports-message-page">
      <section className="reports-empty-state" aria-labelledby="form-message">
        <p className="eyebrow">Daily Paperwork</p>
        <h1 id="form-message">{title}</h1>
        <p>No paperwork was changed.</p>
        <Link className="reports-home-link" href="/admin/paperwork/daily">
          Return to Daily Paperwork
        </Link>
      </section>
    </main>
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
