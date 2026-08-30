import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell } from "@/app/components/admin-shell";
import { DailyPaperworkPackageManager } from "@/features/daily-paperwork/daily-paperwork-package-manager";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listDailyPaperworkTemplatePackagesForCurrentSession } from "@/server/paperwork/list-daily-paperwork-template-packages";

export const dynamic = "force-dynamic";

/** Production-only administrator workflow for reviewing and registering one exact six-form package. */
export default async function DailyPaperworkPackagesPage() {
  if (getRuntimeEnvironment().APP_ENV !== "production") notFound();

  const result = await loadDailyPaperworkTemplatePackages();
  if (result.kind === "denied") return <AccessRequired />;
  if (result.kind === "unavailable") return <Unavailable />;

  return (
    <AdminShell
      brandHref="/admin/paperwork/daily"
      title="Daily Paperwork sources"
    >
      <section className="reports-intro" aria-labelledby="package-page-title">
        <p className="eyebrow">Administrator workspace</p>
        <h1 id="package-page-title">Approved form packages</h1>
        <p>
          Review all six Daily Paperwork definitions together, then confirm the
          exact checked package with your administrator passcode. Real source
          files are accepted only inside the isolated Production environment.
        </p>
      </section>

      <DailyPaperworkPackageManager packages={result.packages} />
    </AdminShell>
  );
}

export async function loadDailyPaperworkTemplatePackages() {
  try {
    return await listDailyPaperworkTemplatePackagesForCurrentSession(
      await createSupabaseServerClient(),
      20,
    );
  } catch {
    return { kind: "unavailable" } as const;
  }
}

function AccessRequired() {
  return (
    <MessagePage
      eyebrow="Private workspace"
      title="Administrator access is required."
      copy="Approved form packages are available only to a current administrator account."
    />
  );
}

function Unavailable() {
  return (
    <MessagePage
      eyebrow="Package history unavailable"
      title="Approved form packages cannot load right now."
      copy="No form package has been reviewed or registered."
    />
  );
}

function MessagePage({
  eyebrow,
  title,
  copy,
}: Readonly<{ eyebrow: string; title: string; copy: string }>) {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="package-message-title"
      >
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="package-message-title">{title}</h1>
        <p>{copy}</p>
        <Link className="reports-home-link" href="/admin/paperwork/daily">
          Return to Daily Paperwork
        </Link>
      </section>
    </main>
  );
}
