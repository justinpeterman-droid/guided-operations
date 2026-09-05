"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";

import { getReportTypeDefinition } from "@/features/incidents/report-types";
import { getReportChecklistCategory } from "@/features/incidents/report-assistant-checklist";
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
  const searchRef = useRef<HTMLInputElement>(null);
  const clearSearch = () => {
    setQuery("");
    searchRef.current?.focus();
  };
  const visibleIncidents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return incidents;
    return incidents.filter((incident) =>
      [
        incident.incidentNumber,
        incident.displayName,
        incident.category,
        getReportChecklistCategory(incident.category)?.label ?? "",
      ].some((value) => value.toLocaleLowerCase().includes(normalized)),
    );
  }, [incidents, query]);
  const visibleReports = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return reports;
    return reports.filter((report) =>
      [
        report.incidentNumber,
        report.incidentName,
        report.reportType,
        getReportTypeDefinition(report.reportType).label,
      ].some((value) => value.toLocaleLowerCase().includes(normalized)),
    );
  }, [query, reports]);

  return (
    <section className="reports-results" aria-labelledby="reports-title">
      <div className="go-ui reports-search-toolbar">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="report-search">
              Search your authorized reports
            </FieldLabel>
            <Input
              ref={searchRef}
              className="min-h-11"
              aria-describedby="report-search-summary"
              id="report-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Number, name, category, or report type"
              type="search"
              value={query}
            />
          </Field>
        </FieldGroup>
        <Button
          type="button"
          variant="outline"
          onClick={clearSearch}
          disabled={!query}
        >
          Clear search
        </Button>
        <p
          id="report-search-summary"
          role="status"
          className="reports-search-summary"
        >
          Showing {visibleIncidents.length} of {incidents.length} incidents and{" "}
          {visibleReports.length} of {reports.length} reports loaded for your
          account.
        </p>
      </div>
      {visibleIncidents.length > 0 || visibleReports.length > 0 ? (
        <p className="reports-scroll-hint">
          Scroll across the table to see every column.
        </p>
      ) : null}
      {visibleIncidents.length === 0 && visibleReports.length === 0 ? (
        <div className="go-ui">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No authorized reports match this search.</EmptyTitle>
              <EmptyDescription>
                Try an incident number, a shorter name, or clear the search to
                see all loaded records.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : null}
      {visibleReports.length > 0 ? (
        <div
          className="reports-table-wrap"
          role="region"
          aria-label="Authorized report summaries"
          tabIndex={0}
        >
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
                    <span className="go-ui">
                      <Badge variant="secondary">
                        {report.status.replace("_", " ")}
                      </Badge>
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
        <div
          className="reports-table-wrap"
          role="region"
          aria-label="Authorized incident summaries"
          tabIndex={0}
        >
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
                    <span className="go-ui">
                      <Badge variant="secondary">
                        {incident.status.replace("_", " ")}
                      </Badge>
                    </span>
                  </td>
                  <td>
                    {getReportChecklistCategory(incident.category)?.label ??
                      incident.category}
                  </td>
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
