"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { getReportTypeDefinition } from "@/features/incidents/report-types";
import type { ReportSummary } from "@/server/incidents/list-reports";

export type AuthorizedIncidentSummary = Readonly<{
  incidentId: string;
  incidentNumber: string;
  displayName: string;
  status: "draft" | "in_review" | "complete" | "archived";
  occurredAt: string;
  category: string;
  currentRevisionNumber: number;
}>;

function formatTimestamp(timestamp: string): string {
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp))} UTC`;
}

/** Filters only server-authorized summaries already delivered to this page. */
export function ReportsList({
  incidents,
  reports,
}: {
  incidents: readonly AuthorizedIncidentSummary[];
  reports: readonly ReportSummary[];
}) {
  const [query, setQuery] = useState("");
  const visibleIncidents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return incidents;
    return incidents.filter((incident) =>
      [incident.incidentNumber, incident.displayName, incident.category].some(
        (value) => value.toLocaleLowerCase().includes(normalized),
      ),
    );
  }, [incidents, query]);
  const visibleReports = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return reports;
    return reports.filter((report) =>
      [report.incidentNumber, report.incidentName, report.reportType].some(
        (value) => value.toLocaleLowerCase().includes(normalized),
      ),
    );
  }, [query, reports]);

  return (
    <section className="reports-results" aria-labelledby="reports-title">
      <label className="reports-search" htmlFor="report-search">
        Search your authorized reports
        <input
          id="report-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Number, name, or category"
          type="search"
          value={query}
        />
      </label>
      {visibleIncidents.length === 0 && visibleReports.length === 0 ? (
        <p className="reports-no-results" role="status">
          No authorized reports match this search.
        </p>
      ) : null}
      {visibleReports.length > 0 ? (
        <div className="reports-table-wrap">
          <table>
            <caption>Authorized report summaries</caption>
            <thead>
              <tr>
                <th scope="col">Report</th>
                <th scope="col">Incident</th>
                <th scope="col">Status</th>
                <th scope="col">Revision</th>
              </tr>
            </thead>
            <tbody>
              {visibleReports.map((report) => (
                <tr key={report.reportId}>
                  <th scope="row">
                    <Link href={`/reports/${report.reportId}`}>
                      {getReportTypeDefinition(report.reportType).label}
                    </Link>
                  </th>
                  <td>
                    <strong>{report.incidentNumber}</strong>
                    <span>{report.incidentName}</span>
                  </td>
                  <td>
                    <span className={`.status-badge status-${report.status}`}>
                      {report.status.replace("_", " ")}
                    </span>
                  </td>
                  <td>{report.currentRevisionNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {visibleIncidents.length > 0 ? (
        <div className="reports-table-wrap">
          <table>
            <caption>Authorized incident summaries</caption>
            <thead>
              <tr>
                <th scope="col">Incident</th>
                <th scope="col">Status</th>
                <th scope="col">Category</th>
                <th scope="col">Occurred</th>
                <th scope="col">Revision</th>
              </tr>
            </thead>
            <tbody>
              {visibleIncidents.map((incident) => (
                <tr key={incident.incidentId}>
                  <th scope="row">
                    <Link href={`/incidents/${incident.incidentId}`}>
                      {incident.incidentNumber}
                    </Link>
                    <strong>{incident.displayName}</strong>
                  </th>
                  <td>
                    <span
                      className={`.status-badge status-${incident.status}`}
                    >
                      {incident.status.replace("_", " ")}
                    </span>
                  </td>
                  <td>{incident.category}</td>
                  <td>
                    <time dateTime={incident.occurredAt}>
                      {formatTimestamp(incident.occurredAt)}
                    </time>
                  </td>
                  <td>{incident.currentRevisionNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
