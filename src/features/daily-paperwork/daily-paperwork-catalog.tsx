import Link from "next/link";

import { AdminShell } from "@/app/components/admin-shell";
import {
  dailyPaperworkCatalog,
  SHIFT_OPTIONS,
  shiftLabel,
  type ShiftCode,
} from "@/features/daily-paperwork/catalog";
import type { DailyPaperworkStatus } from "@/server/paperwork/list-daily-paperwork-status";

export function DailyPaperworkCatalog({
  forms,
  workDate,
  shiftCode,
  canManagePackages = false,
}: Readonly<{
  forms: readonly DailyPaperworkStatus[];
  workDate: string;
  shiftCode: ShiftCode;
  canManagePackages?: boolean;
}>) {
  return (
    <AdminShell
      className="reports-page daily-paperwork-page"
      title="Daily Paperwork"
    >
      <section className="reports-intro" aria-labelledby="daily-title">
        <p className="eyebrow">Administrator workspace</p>
        <h1 id="daily-title">Daily Paperwork</h1>
        <p>
          Choose a date and shift to see the six approved form types. Private
          form details are loaded only when their source has been reviewed and
          approved.
        </p>
        {canManagePackages ? (
          <Link
            className="reports-home-link"
            href="/admin/paperwork/daily/packages"
          >
            Manage approved form packages
          </Link>
        ) : null}
      </section>

      <form noValidate className="daily-paperwork-filter" method="get">
        <label>
          Work date
          <input defaultValue={workDate} name="workDate" required type="date" />
        </label>
        <label>
          Shift
          <select defaultValue={shiftCode} name="shiftCode">
            {SHIFT_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Show paperwork</button>
      </form>

      <section
        className="daily-paperwork-section"
        aria-labelledby="daily-selection-title"
      >
        <div className="daily-paperwork-heading">
          <div>
            <p className="eyebrow">Selected work period</p>
            <h2 id="daily-selection-title">
              {formatWorkDate(workDate)} · {shiftLabel(shiftCode)}
            </h2>
          </div>
          <span>{forms.length} form types</span>
        </div>

        <div className="daily-paperwork-grid">
          {forms.map((form, index) => {
            const catalogItem = dailyPaperworkCatalog[index];
            return (
              <article key={form.kind}>
                <div className="daily-paperwork-card-heading">
                  <span aria-hidden="true">{index + 1}</span>
                  <div>
                    <p className="eyebrow">{formatKind(form.kind)}</p>
                    <h3>{form.title}</h3>
                  </div>
                </div>
                <p>{catalogItem?.purpose}</p>
                <PaperworkState
                  form={form}
                  shiftCode={shiftCode}
                  workDate={workDate}
                />
              </article>
            );
          })}
        </div>
      </section>
    </AdminShell>
  );
}

function PaperworkState({
  form,
  workDate,
  shiftCode,
}: Readonly<{
  form: DailyPaperworkStatus;
  workDate: string;
  shiftCode: ShiftCode;
}>) {
  if (!form.configured) {
    return (
      <div className="daily-paperwork-state is-waiting">
        <strong>Waiting for approved source</strong>
        <span>No private form details are available yet.</span>
      </div>
    );
  }

  if (form.recordId) {
    return (
      <div className="daily-paperwork-state is-loaded">
        <strong>Saved work found</strong>
        <span>Current saved version: {form.currentRevisionNumber}</span>
        <Link
          href={`/admin/paperwork/daily/${form.kind}?workDate=${encodeURIComponent(workDate)}&shiftCode=${shiftCode}`}
        >
          Open saved form
        </Link>
      </div>
    );
  }

  return (
    <div className="daily-paperwork-state is-loaded">
      <strong>Approved source loaded</strong>
      <span>The protected editor is ready for this form.</span>
      <Link
        href={`/admin/paperwork/daily/${form.kind}?workDate=${encodeURIComponent(workDate)}&shiftCode=${shiftCode}`}
      >
        Open blank form
      </Link>
    </div>
  );
}

function formatKind(value: string): string {
  return value.replaceAll("_", " ");
}

function formatWorkDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
