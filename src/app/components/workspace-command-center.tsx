import Link from "next/link";

import { GuidedMark } from "@/app/components/workspace-brand";
import type { ReportSummary } from "@/server/incidents/list-reports";

export { GuidedMark };

type CommandIconName = "report" | "history" | "policy" | "forms";

const previewWork = [
  {
    label: "Training report · Draft",
    status: "Draft",
    href: "/preview/report-assistant",
  },
  {
    label: "Training report · Ready for review",
    status: "Ready for review",
    href: "/preview/report-assistant",
  },
] as const;

const allTools: readonly {
  label: string;
  href: string;
  icon: CommandIconName;
}[] = [
  {
    label: "Start a clear report",
    href: "/preview/report-assistant",
    icon: "report",
  },
  { label: "Reports and history", href: "/reports", icon: "history" },
  {
    label: "Policy reference",
    href: "/preview/policy-expert",
    icon: "policy",
  },
  {
    label: "Daily paperwork",
    href: "/preview/forms-library",
    icon: "forms",
  },
];

const officerTools: readonly {
  label: string;
  href: string;
  icon: CommandIconName;
}[] = [
  {
    label: "Start a report",
    href: "/incidents/new",
    icon: "report",
  },
  { label: "Reports and history", href: "/reports", icon: "history" },
  {
    label: "Policy reference",
    href: "/policy-expert",
    icon: "policy",
  },
  {
    label: "Count Sheet",
    href: "/count-sheet",
    icon: "forms",
  },
  {
    label: "Forms library",
    href: "/forms",
    icon: "forms",
  },
];

function ArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 18 18">
      <path d="M3.5 9h10M9.5 4l5 5-5 5" />
    </svg>
  );
}

function CommandIcon({ name }: Readonly<{ name: CommandIconName }>) {
  if (name === "history") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 32 32">
        <path d="M7 9v7h7" />
        <path d="M8.5 16a9 9 0 1 0 2.2-6" />
        <path d="M16 11v5l3.5 2" />
      </svg>
    );
  }

  if (name === "policy") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 32 32">
        <path d="M5.5 7.5c3.2-1.5 6.3-1.5 9.5 0v17c-3.2-1.5-6.3-1.5-9.5 0zM26.5 7.5c-3.2-1.5-6.3-1.5-9.5 0v17c3.2-1.5 6.3-1.5 9.5 0z" />
        <path d="M9 12h3M20 12h3M9 16h3M20 16h3" />
      </svg>
    );
  }

  if (name === "forms") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 32 32">
        <rect height="21" rx="2" width="16" x="8" y="7" />
        <path d="M13 7V5h6v2M12 13h8M12 18h2M16 18h4M12 23h2M16 23h4" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 32 32">
      <path d="M9 4.5h10l5 5V27H9z" />
      <path d="M19 4.5v5h5M13 15h7M13 19h7M13 23h4" />
      <path d="m22.5 23.5 4-4 2 2-4 4-3 1z" />
    </svg>
  );
}

function PriorityAction({
  copy,
  href,
  icon,
  label,
}: Readonly<{
  copy: string;
  href: string;
  icon: CommandIconName;
  label: string;
}>) {
  return (
    <Link className="command-center-priority-action" href={href}>
      <span className="command-center-priority-icon">
        <CommandIcon name={icon} />
      </span>
      <span className="command-center-priority-copy">
        <strong>{label}</strong>
        <small>{copy}</small>
      </span>
      <ArrowIcon />
    </Link>
  );
}

/** Presentational, preview-only action center; it never creates data. */
export function WorkspaceCommandCenter() {
  return (
    <>
      <section
        className="command-center"
        aria-labelledby="command-center-title"
      >
        <div className="command-center-layout">
          <div className="command-center-intro">
            <h1 id="command-center-title">
              You did the work. Keep the paperwork clear.
            </h1>
            <p>
              Choose the right starting point. Both paths keep the source and
              your review in view.
            </p>
            <div className="command-center-priority-actions">
              <PriorityAction
                copy="Turn known facts into reviewable paperwork."
                href="/preview/report-assistant"
                icon="report"
                label="Start a report"
              />
              <PriorityAction
                copy="Get cited policy guidance and source passages."
                href="/preview/policy-expert"
                icon="policy"
                label="Ask Policy Expert"
              />
            </div>
            <div className="command-center-quick-actions">
              <Link href="/preview/forms-library">Open forms</Link>
            </div>
          </div>

          <section
            className="command-center-work"
            aria-labelledby="your-work-title"
          >
            <div className="command-center-work-heading">
              <h2 id="your-work-title">Your work</h2>
              <p>Fictional training examples</p>
            </div>
            <ul>
              {previewWork.map((item) => (
                <li key={item.label}>
                  <CommandIcon name="report" />
                  <Link href={item.href}>
                    <span>Training example</span>
                    <strong>{item.label}</strong>
                  </Link>
                  <em>{item.status}</em>
                </li>
              ))}
            </ul>
            <Link
              className="command-center-history-link"
              href="/reports"
              prefetch={false}
            >
              View report history <ArrowIcon />
            </Link>
          </section>
        </div>

        <section
          className="command-center-path"
          aria-labelledby="review-path-title"
        >
          <h2 id="review-path-title" className="sr-only">
            Review path
          </h2>
          <ol>
            <li>Capture</li>
            <li className="is-current">Review</li>
            <li>Confirm</li>
          </ol>
          <p>You review before anything becomes official.</p>
        </section>
      </section>

      <section
        className="command-center-tools command-center-tools-supporting"
        aria-labelledby="all-tools-title"
      >
        <h2 id="all-tools-title">More tools</h2>
        <ul>
          {allTools.map((tool) => (
            <li key={tool.label}>
              <Link href={tool.href} prefetch={tool.href !== "/reports"}>
                <span className="command-center-tool-icon">
                  <CommandIcon name={tool.icon} />
                </span>
                <span>{tool.label}</span>
                <ArrowIcon />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/**
 * The signed-in command center only receives report summaries already
 * authorized by the server. It deliberately has no fallback sample work.
 */
export function OfficerCommandCenter({
  reports,
}: Readonly<{
  reports: readonly ReportSummary[] | null;
}>) {
  const visibleReports = reports?.slice(0, 2) ?? [];

  return (
    <>
      <section
        className="command-center"
        aria-labelledby="command-center-title"
      >
        <div className="command-center-layout">
          <div className="command-center-intro">
            <h1 id="command-center-title">
              You did the work. Keep the paperwork clear.
            </h1>
            <p>
              Choose the right starting point. Both paths keep the source and
              your review in view.
            </p>
            <div className="command-center-priority-actions">
              <PriorityAction
                copy="Turn known facts into reviewable paperwork."
                href="/incidents/new"
                icon="report"
                label="Start a report"
              />
              <PriorityAction
                copy="Get cited policy guidance and source passages."
                href="/policy-expert"
                icon="policy"
                label="Ask Policy Expert"
              />
            </div>
            <div className="command-center-quick-actions">
              <Link href="/forms">Open forms</Link>
            </div>
          </div>

          <section
            className="command-center-work"
            aria-labelledby="your-work-title"
          >
            <div className="command-center-work-heading">
              <h2 id="your-work-title">Your work</h2>
              <p>Authorized reports</p>
            </div>
            {reports === null ? (
              <p className="command-center-empty-work" role="status">
                Your report list cannot load right now. Your work has not been
                changed.
              </p>
            ) : visibleReports.length === 0 ? (
              <p className="command-center-empty-work">
                No reports are available for your account yet.
              </p>
            ) : (
              <ul>
                {visibleReports.map((report) => (
                  <li key={report.reportId}>
                    <CommandIcon name="report" />
                    <Link href={`/reports/${report.reportId}`}>
                      <span>{report.incidentNumber}</span>
                      <strong>{report.reportType}</strong>
                    </Link>
                    <em>{report.status.replace("_", " ")}</em>
                  </li>
                ))}
              </ul>
            )}
            <Link className="command-center-history-link" href="/reports">
              View report history <ArrowIcon />
            </Link>
          </section>
        </div>

        <section
          className="command-center-path"
          aria-labelledby="review-path-title"
        >
          <h2 id="review-path-title" className="sr-only">
            Review path
          </h2>
          <ol>
            <li>Capture</li>
            <li className="is-current">Review</li>
            <li>Confirm</li>
          </ol>
          <p>You review before anything becomes official.</p>
        </section>
      </section>

      <section
        className="command-center-tools command-center-tools-expanded command-center-tools-supporting"
        aria-labelledby="all-tools-title"
      >
        <h2 id="all-tools-title">More tools</h2>
        <ul>
          {officerTools.map((tool) => (
            <li key={tool.label}>
              <Link href={tool.href}>
                <span className="command-center-tool-icon">
                  <CommandIcon name={tool.icon} />
                </span>
                <span>{tool.label}</span>
                <ArrowIcon />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
