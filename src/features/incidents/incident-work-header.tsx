import Link from "next/link";

import { getReportChecklistCategory } from "@/features/incidents/report-assistant-checklist";
import type { IncidentSummary } from "@/server/incidents/list-incidents";
import type { IncidentReportWorkspace } from "@/server/incidents/get-incident-report-workspace";

import type { DocumentStudioTabId } from "./document-studio-catalog";
import styles from "./document-studio.module.css";
import type { IncidentNextAction } from "./derive-incident-next-action";

type IncidentWorkHeaderProps = Readonly<{
  incident: IncidentSummary | null;
  nextAction: IncidentNextAction;
  onActivateSection: (section: DocumentStudioTabId) => void;
  workspace: IncidentReportWorkspace;
}>;

function ArrowIcon({ direction }: Readonly<{ direction: "left" | "right" }>) {
  if (direction === "left") {
    return (
      <svg aria-hidden="true" viewBox="0 0 18 18">
        <path d="M14.5 9h-11M8.5 4l-5 5 5 5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 18 18">
      <path d="M3.5 9h11M9.5 4l5 5-5 5" />
    </svg>
  );
}

function formatStatus(status: IncidentSummary["status"]): string {
  return status.replaceAll("_", " ");
}

/** Incident identity and advisory next action derived from authorized data. */
export function IncidentWorkHeader({
  incident,
  nextAction,
  onActivateSection,
  workspace,
}: IncidentWorkHeaderProps) {
  const category = getReportChecklistCategory(workspace.category);

  return (
    <header className={styles.incidentHeader}>
      <Link className={styles.backLink} href="/reports">
        <ArrowIcon direction="left" />
        Back to reports
      </Link>

      <div className={styles.identity}>
        <h1>{workspace.displayName}</h1>
        <ul className={styles.metadata} aria-label="Incident summary">
          <li>{workspace.incidentNumber}</li>
          <li>{category?.label ?? workspace.category}</li>
          <li>Revision {workspace.revisionNumber}</li>
          {incident ? (
            <li>
              <span className={`status-badge status-${incident.status}`}>
                {formatStatus(incident.status)}
              </span>
            </li>
          ) : null}
        </ul>
      </div>

      <section
        className={styles.nextAction}
        aria-labelledby="incident-next-action-title"
      >
        <div>
          <h2 id="incident-next-action-title">Next action</h2>
          <p>{nextAction.summary}</p>
        </div>
        <button
          onClick={() => onActivateSection(nextAction.destination)}
          type="button"
        >
          {nextAction.label}
          <ArrowIcon direction="right" />
        </button>
      </section>
    </header>
  );
}
