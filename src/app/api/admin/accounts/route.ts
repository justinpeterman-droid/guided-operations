import { z } from "zod";

import { getAuthServerEnvironment } from "@/lib/env/auth-server";
import { getRuntimeEnvironment } from "@/lib/env/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminInviteAuthorization } from "@/server/auth/authorize-admin-invite";
import { authorizeCurrentSession } from "@/server/auth/current-session";
import { inviteAccount } from "@/server/auth/invite-account";
import { createAdminStepUpStore } from "@/server/auth/private-admin-step-up-store";
import { createInvitedAccountStore } from "@/server/auth/private-invited-account-store";
import { createSupabaseAuthUserProvisioner } from "@/server/auth/supabase-auth-adapters";
import { isTrustedMutationRequest } from "@/server/security/request-origin";
import { hasValidSessionCsrfRequest } from "@/server/security/session-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const requestSchema = z
  .object({
    employeeNumber: z.string().min(1).max(64),
    displayName: z.string().min(1).max(120),
    role: z.enum(["officer", "administrator"]),
    requestId: z.string().uuid(),
    token: z.string().min(32).max(256),
  })
  .strict();

function employeeNumberHint(employeeNumber: string): string {
  const normalized = employeeNumber.normalize("NFKC").trim();
  return normalized.slice(-4) || "—";
}

/**
 * Creates one private account only after a same-session, one-time administrator
 * proof. The temporary passcode exists only in this request and is returned
 * once to that administrator for the approved in-person handoff.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const [environment, runtimeEnvironment, client] = await Promise.all([
      getAuthServerEnvironment(),
      getRuntimeEnvironment(),
      createSupabaseServerClient(),
    ]);
    const session = await authorizeCurrentSession(client, {
      requiredRole: "administrator",
    });
    if (!session.allowed) return authenticationRequired();
    if (
      !isTrustedMutationRequest(request, runtimeEnvironment.APP_ORIGIN) ||
      !hasValidSessionCsrfRequest(
        request.headers,
        session.sessionId,
        environment.CSRF_HMAC_KEY,
      )
    ) {
      return requestNotAllowed();
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput();

    let handoff:
      Readonly<{ temporaryPasscode: string; expiresAt: Date }> | undefined;
    const input = parsed.data;
    const result = await inviteAccount(
      {
        employeeNumber: input.employeeNumber,
        employeeNumberHint: employeeNumberHint(input.employeeNumber),
        displayName: input.displayName.normalize("NFKC").trim(),
        role: input.role,
      },
      {
        authorization: createAdminInviteAuthorization(
          { requestId: input.requestId, token: input.token },
          {
            authUserId: session.account.authUserId,
            sessionId: session.sessionId,
            authVersion: session.account.authVersion,
          },
          {
            store: createAdminStepUpStore(),
            hmacKey: environment.CSRF_HMAC_KEY,
          },
        ),
        authUserProvisioner: createSupabaseAuthUserProvisioner(),
        store: createInvitedAccountStore(),
        delivery: {
          async deliver(delivery) {
            handoff = {
              temporaryPasscode: delivery.temporaryPasscode,
              expiresAt: delivery.expiresAt,
            };
          },
        },
        employeeLookupHmacKey: environment.EMPLOYEE_LOOKUP_PEPPER,
      },
    );

    if (result.status === "denied") return authenticationRequired();
    if (result.status !== "activated" || !handoff) return unavailable();
    return Response.json(
      {
        data: {
          employeeNumberHint: employeeNumberHint(input.employeeNumber),
          temporaryPasscode: handoff.temporaryPasscode,
          temporaryPasscodeExpiresAt: handoff.expiresAt.toISOString(),
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return unavailable();
  }
}

function authenticationRequired(): Response {
  return Response.json(
    { error: "authentication_required" },
    { status: 401, headers: NO_STORE_HEADERS },
  );
}

function requestNotAllowed(): Response {
  return Response.json(
    { error: "request_not_allowed" },
    { status: 403, headers: NO_STORE_HEADERS },
  );
}

function invalidInput(): Response {
  return Response.json(
    { error: "invalid_account" },
    { status: 400, headers: NO_STORE_HEADERS },
  );
}

function unavailable(): Response {
  return Response.json(
    { error: "service_unavailable" },
    { status: 503, headers: NO_STORE_HEADERS },
  );
}
