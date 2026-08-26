"use client";

import { useMemo, useState } from "react";

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
}: {
  incidents: readonly AuthorizedIncidentSummary[];
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
      {visibleIncidents.length === 0 ? (
        <p className="reports-no-results" role="status">
          No authorized reports match this search.
        </p>
      ) : (
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
                    <span>{incident.incidentNumber}</span>
                    <strong>{incident.displayName}</strong>
                  </th>
                  <td>
                    <span
                      className={`incident-status status-${incident.status}`}
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
      )}
    </section>
  );
}
