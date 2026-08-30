"use client";

import Link from "next/link";
import { useCallback, useState, type KeyboardEvent } from "react";

import { ReportDraftRequestForm } from "@/app/incidents/[incidentId]/report-draft-request-form";
import {
  describeDocumentStudioForm,
  DOCUMENT_STUDIO_TABS,
  type DocumentStudioFormCapability,
  type DocumentStudioTabId,
} from "@/features/incidents/document-studio-catalog";
import { getReportChecklistCategory } from "@/features/incidents/report-assistant-checklist";
import { getReportTypeDefinition } from "@/features/incidents/report-types";
import type { StoredReviewedFact } from "@/features/incidents/schema";
import type { IncidentSummary } from "@/server/incidents/list-incidents";
import type { IncidentReportWorkspace } from "@/server/incidents/get-incident-report-workspace";
import type { ReportSummary } from "@/server/incidents/list-reports";

/** The tab panel is rendered once and reused, so every tab controls this id. */
const DOCUMENT_STUDIO_PANEL_ID = "document-studio-panel";

export type DocumentStudioProps = Readonly<{
  incident: IncidentSummary | null;
  reports: readonly ReportSummary[];
  workspace: IncidentReportWorkspace;
}>;

function formatTimestamp(timestamp: string): string {
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp))} UTC`;
}

function capabilityLabel(capability: DocumentStudioFormCapability): string {
  switch (capability) {
    case "available_in_reports":
      return "Available in Officer Reports";
    case "physical_only":
      return "Physical only";
    case "not_yet_available":
      return "Not yet available";
    default: {
      const unreachable: never = capability;
      return unreachable;
    }
  }
}

function countConfirmedFacts(facts: readonly StoredReviewedFact[]): number {
  return facts.filter((fact) => fact.state === "confirmed").length;
}

function OverviewPanel({ incident, reports, workspace }: DocumentStudioProps) {
  const checklistCategory = getReportChecklistCategory(workspace.category);

  return (
    <section
      aria-labelledby="studio-overview-title"
      className="document-studio-panel"
    >
      <h2 id="studio-overview-title">Overview</h2>
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
                  {incident.status.replace("_", " ")}
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
          <dd>{countConfirmedFacts(workspace.reviewedFacts)}</dd>
        </div>
        <div>
          <dt>Reports on this incident</dt>
          <dd>{reports.length}</dd>
        </div>
      </dl>
      <p className="document-studio-footnote">
        Every value above comes from the current authorized revision. Nothing
        here invents workflow progress or packet completeness.
      </p>
    </section>
  );
}

function OfficerReportsPanel({ reports, workspace }: DocumentStudioProps) {
  return (
    <section
      aria-labelledby="studio-reports-title"
      className="document-studio-panel"
    >
      <h2 id="studio-reports-title">Officer Reports</h2>
      <p>
        Request a review draft from confirmed facts, then open finalized reports
        when they exist. Reporting officer attribution stays visible through
        every step.
      </p>

      {reports.length > 0 ? (
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
                      {report.status.replace("_", " ")}
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

      <ReportDraftRequestForm workspace={workspace} />
    </section>
  );
}

function CopyToRecordsPanel() {
  return (
    <section
      aria-labelledby="studio-copy-title"
      className="document-studio-panel"
    >
      <h2 id="studio-copy-title">Copy to Records</h2>
      <p>
        Copy-only records text is separate from printable officer reports. It
        must stay editable, clearly labeled, and free of fake print or Word
        actions.
      </p>
      <p className="document-studio-empty" role="status">
        Copy-to-records output is not yet available in this workspace. Use
        Officer Reports for supported draft, review, and finalize work until the
        copy-only path is approved and tested.
      </p>
    </section>
  );
}

function RequiredPaperworkPanel({ workspace }: DocumentStudioProps) {
  const checklistCategory = getReportChecklistCategory(workspace.category);

  if (!checklistCategory) {
    return (
      <section
        aria-labelledby="studio-paperwork-title"
        className="document-studio-panel"
      >
        <h2 id="studio-paperwork-title">Required Paperwork</h2>
        <p className="document-studio-empty" role="status">
          No approved paperwork catalog matches this incident category yet.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="studio-paperwork-title"
      className="document-studio-panel"
    >
      <h2 id="studio-paperwork-title">Required Paperwork</h2>
      <p>
        Required items for <strong>{checklistCategory.label}</strong>.
        Capabilities stay explicit; physical-only forms never receive a digital
        substitute here.
      </p>
      <ul className="document-studio-form-list">
        {checklistCategory.requiredForms.map((formKey) => {
          const entry = describeDocumentStudioForm(formKey);
          return (
            <li key={formKey}>
              <div>
                <strong>{entry.label}</strong>
                <p>{entry.detail}</p>
              </div>
              <span
                className={`document-studio-capability capability-${entry.capability}`}
              >
                {capabilityLabel(entry.capability)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NotesAndFactsPanel({ workspace }: DocumentStudioProps) {
  const facts = workspace.reviewedFacts;

  return (
    <section
      aria-labelledby="studio-notes-title"
      className="document-studio-panel"
    >
      <h2 id="studio-notes-title">Notes &amp; Facts</h2>
      <p>
        Raw field notes stay server-side. This tab shows only the reviewed fact
        states stored on revision {workspace.revisionNumber}.
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
                  {fact.state.replace("_", " ")}
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

function HistoryPanel({ reports, workspace }: DocumentStudioProps) {
  return (
    <section
      aria-labelledby="studio-history-title"
      className="document-studio-panel"
    >
      <h2 id="studio-history-title">History</h2>
      <p>
        Incident revisions are append-only. Report revisions stay on each report
        record and can be restored only through deliberate review actions.
      </p>

      <article className="document-studio-history-card">
        <h3>Current incident revision</h3>
        <p>
          Revision <strong>{workspace.revisionNumber}</strong> is the active
          revision for this incident.
        </p>
        <p className="document-studio-footnote">
          A full incident revision browser is not yet exposed here. Earlier
          incident revisions remain stored and can be reviewed through future
          authorized history tools.
        </p>
      </article>

      {reports.length > 0 ? (
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
  );
}

/** Six-tab Document Studio shell for one authorized incident revision. */
export function DocumentStudio(props: DocumentStudioProps) {
  const [activeTab, setActiveTab] = useState<DocumentStudioTabId>("overview");

  const focusTab = useCallback((tabId: DocumentStudioTabId) => {
    document.getElementById(`document-studio-tab-${tabId}`)?.focus();
  }, []);

  function activateTab(tabId: DocumentStudioTabId) {
    setActiveTab(tabId);
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
    activateTab(nextTab.id);
    focusTab(nextTab.id);
  }

  return (
    <div className="document-studio">
      <div className="document-studio-tabs">
        <ul aria-label="Document Studio sections" role="tablist">
          {DOCUMENT_STUDIO_TABS.map((tab) => (
            <li key={tab.id} role="presentation">
              <button
                aria-controls={DOCUMENT_STUDIO_PANEL_ID}
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? "is-current" : undefined}
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
        className="document-studio-panel-wrap"
        id={DOCUMENT_STUDIO_PANEL_ID}
        role="tabpanel"
      >
        {activeTab === "overview" ? <OverviewPanel {...props} /> : null}
        {activeTab === "officer-reports" ? (
          <OfficerReportsPanel {...props} />
        ) : null}
        {activeTab === "copy-to-records" ? <CopyToRecordsPanel /> : null}
        {activeTab === "required-paperwork" ? (
          <RequiredPaperworkPanel {...props} />
        ) : null}
        {activeTab === "notes-facts" ? <NotesAndFactsPanel {...props} /> : null}
        {activeTab === "history" ? <HistoryPanel {...props} /> : null}
      </div>
    </div>
  );
}
