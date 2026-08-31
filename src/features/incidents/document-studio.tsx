"use client";

import Link from "next/link";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { ReportDraftRequestForm } from "@/app/incidents/[incidentId]/report-draft-request-form";
import { getReportChecklistCategory } from "@/features/incidents/report-assistant-checklist";
import { getReportTypeDefinition } from "@/features/incidents/report-types";
import type { StoredReviewedFact } from "@/features/incidents/schema";
import type { IncidentReportWorkspace } from "@/server/incidents/get-incident-report-workspace";
import type { IncidentSummary } from "@/server/incidents/list-incidents";
import type { ReportSummary } from "@/server/incidents/list-reports";

import {
  describeDocumentStudioForm,
  DOCUMENT_STUDIO_TABS,
  type DocumentStudioFormCapability,
  type DocumentStudioTabId,
} from "./document-studio-catalog";
import styles from "./document-studio.module.css";
import { deriveIncidentNextAction } from "./derive-incident-next-action";
import { IncidentWorkHeader } from "./incident-work-header";

/** The tab panel is rendered once and reused, so every tab controls this id. */
const DOCUMENT_STUDIO_PANEL_ID = "document-studio-panel";

const SECTION_HEADING_IDS: Record<DocumentStudioTabId, string> = {
  reports: "studio-reports-title",
  "notes-facts": "studio-notes-title",
  paperwork: "studio-paperwork-title",
  "incident-record": "studio-record-title",
};

const PAPERWORK_GROUPS = [
  {
    capability: "available_in_reports",
    title: "Available through Officer Reports",
    description: "Create supported report outputs through the Reports section.",
  },
  {
    capability: "physical_only",
    title: "Physical form required",
    description: "Obtain and complete the approved paper form by hand.",
  },
  {
    capability: "not_yet_available",
    title: "Digital support not yet available",
    description:
      "These items remain unavailable until approved digital mapping and fidelity work is complete.",
  },
] as const satisfies ReadonlyArray<{
  capability: DocumentStudioFormCapability;
  title: string;
  description: string;
}>;

export type DocumentStudioProps = Readonly<{
  incident: IncidentSummary | null;
  reports: readonly ReportSummary[] | null;
  workspace: IncidentReportWorkspace;
}>;

function formatTimestamp(timestamp: string): string {
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp))} UTC`;
}

/**
 * The server hands back every fact stored on the revision; scoping to a
 * reporting officer happens where facts are displayed. A confirmed version-two
 * fact with an empty scope belongs to no reporter, so it is not shown here.
 */
function scopedFacts(
  facts: readonly StoredReviewedFact[],
): readonly StoredReviewedFact[] {
  return facts.filter((fact) => {
    if (fact.state !== "confirmed") return true;
    if (!("reportingStaffMemberIds" in fact)) return true;
    return fact.reportingStaffMemberIds.length > 0;
  });
}

function countVisibleConfirmedFacts(
  facts: readonly StoredReviewedFact[],
): number {
  return scopedFacts(facts).filter((fact) => fact.state === "confirmed").length;
}

function ReportsPanel({ reports, workspace }: DocumentStudioProps) {
  return (
    <section
      aria-labelledby={SECTION_HEADING_IDS.reports}
      className={styles.panel}
    >
      <h2 id={SECTION_HEADING_IDS.reports} tabIndex={-1}>
        Reports
      </h2>
      <p>
        Request a review draft from confirmed facts, then open finalized reports
        when they exist. Reporting officer attribution stays visible through
        every step.
      </p>

      {reports === null ? (
        <p className="document-studio-empty" role="status">
          Reports cannot load right now. Existing report work has not been
          changed, and a new draft cannot be requested from this view.
        </p>
      ) : reports.length > 0 ? (
        <div className="reports-table-wrap document-studio-table">
          <table>
            <caption>Reports linked to this incident</caption>
            <thead>
              <tr>
                <th scope="col">Report</th>
                <th scope="col">Status</th>
                <th scope="col">Revision</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.reportId}>
                  <th scope="row">
                    <Link href={`/reports/${report.reportId}`}>
                      {getReportTypeDefinition(report.reportType).label}
                    </Link>
                  </th>
                  <td>
                    <span className={`status-badge status-${report.status}`}>
                      {report.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>{report.currentRevisionNumber}</td>
                  <td>
                    <time dateTime={report.updatedAt}>
                      {formatTimestamp(report.updatedAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="document-studio-empty" role="status">
          No reports exist for this incident yet.
        </p>
      )}

      {reports !== null ? (
        <ReportDraftRequestForm workspace={workspace} />
      ) : null}

      <section
        className={styles.subsection}
        aria-labelledby="studio-copy-title"
      >
        <h3 id="studio-copy-title">Copy to Records</h3>
        <p>
          Copy-only records text stays separate from printable officer reports.
        </p>
        <p className="document-studio-empty" role="status">
          Copy-to-records output is not yet available in this workspace. Use
          Reports for supported draft, review, and finalize work until the
          copy-only path is approved and tested.
        </p>
      </section>
    </section>
  );
}

function PaperworkPanel({ workspace }: DocumentStudioProps) {
  const checklistCategory = getReportChecklistCategory(workspace.category);

  if (!checklistCategory) {
    return (
      <section
        aria-labelledby={SECTION_HEADING_IDS.paperwork}
        className={styles.panel}
      >
        <h2 id={SECTION_HEADING_IDS.paperwork} tabIndex={-1}>
          Paperwork
        </h2>
        <p className="document-studio-empty" role="status">
          No approved paperwork catalog matches this incident category yet.
        </p>
      </section>
    );
  }

  const entries = checklistCategory.requiredForms.map((formKey) => ({
    formKey,
    ...describeDocumentStudioForm(formKey),
  }));

  return (
    <section
      aria-labelledby={SECTION_HEADING_IDS.paperwork}
      className={styles.panel}
    >
      <h2 id={SECTION_HEADING_IDS.paperwork} tabIndex={-1}>
        Paperwork
      </h2>
      <p>
        Required items for <strong>{checklistCategory.label}</strong>. Digital
        capability stays explicit, and physical-only forms never receive a
        substitute here.
      </p>

      <div className={styles.capabilityGroups}>
        {PAPERWORK_GROUPS.map((group) => {
          const groupEntries = entries.filter(
            (entry) => entry.capability === group.capability,
          );
          if (groupEntries.length === 0) return null;

          const headingId = `paperwork-${group.capability}-title`;
          return (
            <section
              className={styles.capabilityGroup}
              aria-labelledby={headingId}
              key={group.capability}
            >
              <h3 id={headingId}>{group.title}</h3>
              <p>{group.description}</p>
              <ul className={styles.capabilityList}>
                {groupEntries.map((entry) => (
                  <li key={entry.formKey}>
                    <strong>{entry.label}</strong>
                    <p>{entry.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function NotesAndFactsPanel({ workspace }: DocumentStudioProps) {
  const facts = scopedFacts(workspace.reviewedFacts);

  return (
    <section
      aria-labelledby={SECTION_HEADING_IDS["notes-facts"]}
      className={styles.panel}
    >
      <h2 id={SECTION_HEADING_IDS["notes-facts"]} tabIndex={-1}>
        Notes &amp; Facts
      </h2>
      <p>
        Raw field notes stay server-side. This section shows only the reviewed
        fact states stored on revision {workspace.revisionNumber}.
      </p>

      {facts.length === 0 ? (
        <p className="document-studio-empty" role="status">
          No reviewed facts are stored on the current revision.
        </p>
      ) : (
        <ul className="document-studio-fact-list">
          {facts.map((fact) => (
            <li key={fact.id}>
              <div className="document-studio-fact-heading">
                <strong>{fact.field}</strong>
                <span
                  className={`document-studio-fact-state state-${fact.state}`}
                >
                  {fact.state.replaceAll("_", " ")}
                </span>
              </div>
              {fact.state === "confirmed" ? (
                <>
                  <p>{fact.value}</p>
                  {"reportingStaffMemberIds" in fact ? (
                    <p className="document-studio-footnote">
                      Approved for {fact.reportingStaffMemberIds.length}{" "}
                      reporting officer
                      {fact.reportingStaffMemberIds.length === 1 ? "" : "s"}.
                    </p>
                  ) : null}
                </>
              ) : (
                <p>{fact.reason}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IncidentRecordPanel({
  incident,
  reports,
  workspace,
}: DocumentStudioProps) {
  const checklistCategory = getReportChecklistCategory(workspace.category);

  return (
    <section
      aria-labelledby={SECTION_HEADING_IDS["incident-record"]}
      className={styles.panel}
    >
      <h2 id={SECTION_HEADING_IDS["incident-record"]} tabIndex={-1}>
        Incident Record
      </h2>
      <p>
        Review the current authorized incident revision and the report revision
        heads linked to it.
      </p>

      <div className={styles.recordSections}>
        <section
          className={styles.recordSection}
          aria-labelledby="studio-record-details-title"
        >
          <h3 id="studio-record-details-title">Current incident details</h3>
          <dl className="document-studio-summary-grid">
            <div>
              <dt>Incident number</dt>
              <dd>{workspace.incidentNumber}</dd>
            </div>
            <div>
              <dt>Incident name</dt>
              <dd>{workspace.displayName}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{checklistCategory?.label ?? workspace.category}</dd>
            </div>
            <div>
              <dt>Current revision</dt>
              <dd>{workspace.revisionNumber}</dd>
            </div>
            {incident ? (
              <>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className={`status-badge status-${incident.status}`}>
                      {incident.status.replaceAll("_", " ")}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Occurred</dt>
                  <dd>
                    <time dateTime={incident.occurredAt}>
                      {formatTimestamp(incident.occurredAt)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>
                    <time dateTime={incident.updatedAt}>
                      {formatTimestamp(incident.updatedAt)}
                    </time>
                  </dd>
                </div>
              </>
            ) : (
              <div>
                <dt>Incident summary</dt>
                <dd role="status">
                  Additional incident summary fields cannot load right now.
                </dd>
              </div>
            )}
            <div>
              <dt>Reporting officers</dt>
              <dd>{workspace.reportingOfficers.length}</dd>
            </div>
            <div>
              <dt>Confirmed facts</dt>
              <dd>{countVisibleConfirmedFacts(workspace.reviewedFacts)}</dd>
            </div>
            <div>
              <dt>Reports on this incident</dt>
              <dd>{reports?.length ?? "Unavailable"}</dd>
            </div>
          </dl>
          <p className="document-studio-footnote">
            Every value above comes from the current authorized revision.
            Nothing here invents workflow progress or packet completeness.
          </p>
        </section>

        <section
          className={styles.recordSection}
          aria-labelledby="studio-record-history-title"
        >
          <h3 id="studio-record-history-title">Revision history</h3>
          <p>
            Incident revisions are append-only. Report revisions stay on each
            report record and can be restored only through deliberate review
            actions.
          </p>

          <article className="document-studio-history-card">
            <h4>Current incident revision</h4>
            <p>
              Revision {workspace.revisionNumber} is the active revision for
              this incident.
            </p>
            <p className="document-studio-footnote">
              A full incident revision browser is not yet exposed here. Earlier
              incident revisions remain stored and can be reviewed through
              future authorized history tools.
            </p>
          </article>

          {reports === null ? (
            <p className="document-studio-empty" role="status">
              Report revision history cannot load right now. Existing report
              work has not been changed.
            </p>
          ) : reports.length > 0 ? (
            <div className="reports-table-wrap document-studio-table">
              <table>
                <caption>Report revision heads</caption>
                <thead>
                  <tr>
                    <th scope="col">Report</th>
                    <th scope="col">Current revision</th>
                    <th scope="col">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.reportId}>
                      <th scope="row">
                        {getReportTypeDefinition(report.reportType).label}
                      </th>
                      <td>{report.currentRevisionNumber}</td>
                      <td>
                        <Link href={`/reports/${report.reportId}`}>
                          Open report history
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="document-studio-empty" role="status">
              No report history exists yet because no reports have been created.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

/** Four-section Document Studio shell for one authorized incident revision. */
export function DocumentStudio(props: DocumentStudioProps) {
  const [activeTab, setActiveTab] = useState<DocumentStudioTabId>("reports");
  const pendingTabFocus = useRef<DocumentStudioTabId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const nextAction = deriveIncidentNextAction({
    reviewedFacts: props.workspace.reviewedFacts,
    reportingOfficerCount: props.workspace.reportingOfficers.length,
    reports: props.reports,
  });

  const focusTab = useCallback((tabId: DocumentStudioTabId) => {
    rootRef.current
      ?.querySelector<HTMLButtonElement>(`#document-studio-tab-${tabId}`)
      ?.focus();
  }, []);

  useLayoutEffect(() => {
    const tabId = pendingTabFocus.current;
    if (tabId === null) return;

    pendingTabFocus.current = null;
    focusTab(tabId);
  }, [activeTab, focusTab]);

  function activateTab(tabId: DocumentStudioTabId, focusHeading = false) {
    setActiveTab(tabId);
    if (!focusHeading) return;

    window.setTimeout(() => {
      document.getElementById(SECTION_HEADING_IDS[tabId])?.focus();
    }, 0);
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    tabId: DocumentStudioTabId,
  ) {
    const index = DOCUMENT_STUDIO_TABS.findIndex((tab) => tab.id === tabId);
    if (index < 0) return;

    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % DOCUMENT_STUDIO_TABS.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex =
          (index - 1 + DOCUMENT_STUDIO_TABS.length) %
          DOCUMENT_STUDIO_TABS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = DOCUMENT_STUDIO_TABS.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = DOCUMENT_STUDIO_TABS[nextIndex];
    pendingTabFocus.current = nextTab.id;
    activateTab(nextTab.id);
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <IncidentWorkHeader
        incident={props.incident}
        nextAction={nextAction}
        onActivateSection={(tabId) => activateTab(tabId, true)}
        workspace={props.workspace}
      />

      <div className={styles.navigation}>
        <label className={styles.mobileSelect}>
          <span>Section</span>
          <select
            aria-label="Document Studio section"
            onChange={(event) =>
              activateTab(event.target.value as DocumentStudioTabId)
            }
            value={activeTab}
          >
            {DOCUMENT_STUDIO_TABS.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </select>
        </label>

        <ul
          aria-label="Document Studio sections"
          className={styles.tabs}
          role="tablist"
        >
          {DOCUMENT_STUDIO_TABS.map((tab) => (
            <li key={tab.id} role="presentation">
              <button
                aria-controls={DOCUMENT_STUDIO_PANEL_ID}
                aria-selected={activeTab === tab.id}
                className={styles.tabButton}
                id={`document-studio-tab-${tab.id}`}
                onClick={() => activateTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                role="tab"
                tabIndex={activeTab === tab.id ? 0 : -1}
                type="button"
              >
                <span>{tab.label}</span>
                <small>{tab.description}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div
        aria-labelledby={`document-studio-tab-${activeTab}`}
        className={styles.panelWrap}
        id={DOCUMENT_STUDIO_PANEL_ID}
        role="tabpanel"
      >
        {activeTab === "reports" ? <ReportsPanel {...props} /> : null}
        {activeTab === "notes-facts" ? <NotesAndFactsPanel {...props} /> : null}
        {activeTab === "paperwork" ? <PaperworkPanel {...props} /> : null}
        {activeTab === "incident-record" ? (
          <IncidentRecordPanel {...props} />
        ) : null}
      </div>
    </div>
  );
}
