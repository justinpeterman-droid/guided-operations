import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { WorkspaceShell } from "@/app/components/workspace-shell";
import { ImprovementMessageComposer } from "@/app/components/improvement-message-composer";
import { ImprovementReviewControls } from "@/app/components/improvement-review-controls";
import {
  OfficerSignInRequiredMessage,
  OfficerUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { improvementRpc } from "@/server/feedback/improvement-rpc";

export const dynamic = "force-dynamic";

const requestIdSchema = z.uuid();
type Detail = Readonly<{
  request_id: string;
  request_kind: string;
  status: string;
  description: string;
  form_title: string | null;
  target_label: string | null;
  route_path: string | null;
  source_authority: string | null;
  source_revision: string | null;
  requested_use: string | null;
  file_uploaded: boolean | null;
  file_name: string | null;
  created_at: string;
  updated_at: string;
  messages: unknown;
  status_history: unknown;
}>;

export default async function ImprovementRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  if (!requestIdSchema.safeParse(requestId).success) notFound();
  const loaded = await loadDetail(requestId);
  if (loaded.kind === "denied")
    return (
      <OfficerSignInRequiredMessage
        description="Sign in with a current account to view this request."
        title="Sign in to view this request."
      />
    );
  if (loaded.kind === "missing") notFound();
  if (loaded.kind === "unavailable")
    return (
      <OfficerUnavailableMessage
        description="No request information was changed. Please try again later."
        eyebrow="Request unavailable"
        title="This request cannot load right now."
      />
    );
  if (loaded.kind !== "authorized") notFound();
  const request = loaded.request;
  return (
    <WorkspaceShell
      current="Forms"
      title="Request details"
      className="improvement-page"
    >
      <section className="improvement-page-intro">
        <p className="eyebrow">Request details</p>
        <h1>{request.form_title ?? request.target_label ?? "Suggestion"}</h1>
        <p>
          <span
            className={`improvement-status improvement-status-${request.status}`}
          >
            {request.status.replaceAll("_", " ")}
          </span>
        </p>
        <Link href="/improvements">Back to my requests</Link>
      </section>
      <section className="improvement-intake-card improvement-detail">
        <dl>
          <div>
            <dt>Submitted</dt>
            <dd>
              {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                new Date(request.created_at),
              )}
            </dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{request.request_kind.replaceAll("_", " ")}</dd>
          </div>
          {request.route_path ? (
            <div>
              <dt>Page</dt>
              <dd>{request.route_path}</dd>
            </div>
          ) : null}
          {request.file_name ? (
            <div>
              <dt>Candidate</dt>
              <dd>
                {request.file_uploaded
                  ? `Private file received: ${request.file_name}`
                  : "File upload not finalized"}
              </dd>
            </div>
          ) : null}
        </dl>
        <h2>What was requested</h2>
        <p>{request.description}</p>
        {request.source_authority ||
        request.source_revision ||
        request.requested_use ? (
          <>
            <h2>Form details</h2>
            <p>
              {[
                request.source_authority,
                request.source_revision,
                request.requested_use,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </>
        ) : null}
        <h2>Review updates</h2>
        <RequestUpdates
          messages={request.messages}
          history={request.status_history}
        />
        <ImprovementMessageComposer requestId={request.request_id} />
        {loaded.role === "administrator" ? (
          <ImprovementReviewControls
            currentStatus={request.status}
            requestId={request.request_id}
            requestKind={request.request_kind}
          />
        ) : null}
      </section>
    </WorkspaceShell>
  );
}

function RequestUpdates({
  messages,
  history,
}: {
  messages: unknown;
  history: unknown;
}) {
  const records = [...asRecords(history), ...asRecords(messages)];
  return records.length ? (
    <ul className="improvement-update-list">
      {records.map((record, index) => (
        <li key={`${index}-${JSON.stringify(record)}`}>
          {typeof record.body === "string"
            ? record.body
            : typeof record.next_status === "string"
              ? `Status changed to ${record.next_status.replaceAll("_", " ")}.`
              : "Review updated."}
        </li>
      ))}
    </ul>
  ) : (
    <p>
      No review update yet. You can continue your regular work; updates will
      appear here.
    </p>
  );
}
function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}
async function loadDetail(
  requestId: string,
): Promise<
  | { kind: "authorized"; request: Detail; role: string }
  | { kind: "denied" | "missing" | "unavailable" }
> {
  try {
    const client = await createSupabaseServerClient();
    const session = await authorizeCurrentSession(client);
    if (!session.allowed) return { kind: "denied" };
    const result = await improvementRpc<Detail[]>(
      client,
      "get_improvement_request",
      {
        p_request_id: requestId,
      },
    );
    if (result.error) return { kind: "unavailable" };
    return result.data?.[0]
      ? {
          kind: "authorized",
          request: result.data[0],
          role: session.account.role,
        }
      : { kind: "missing" };
  } catch {
    return { kind: "unavailable" };
  }
}
