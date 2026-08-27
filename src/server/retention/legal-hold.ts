import "server-only";

import { z } from "zod";

import type { AdminActionAuthorization } from "@/server/auth/authorize-admin-action";
import {
  authorizeCurrentSession,
  type CurrentSessionClient,
} from "@/server/auth/current-session";

export const LEGAL_HOLD_SCOPE_TYPES = [
  "facility",
  "incident",
  "report",
  "paperwork_record",
  "policy_document",
  "staff_member",
  "user_account",
] as const;

export type LegalHoldScopeType = (typeof LEGAL_HOLD_SCOPE_TYPES)[number];

const authorityReferenceSchema = z
  .string()
  .min(3)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ._:/-]*$/);

const placeInputSchema = z
  .object({
    scopeType: z.enum(LEGAL_HOLD_SCOPE_TYPES),
    scopeId: z.string().uuid(),
    authorityReference: authorityReferenceSchema,
  })
  .strict();

const releaseInputSchema = z
  .object({
    holdId: z.string().uuid(),
    authorityReference: authorityReferenceSchema,
  })
  .strict();

const holdSummarySchema = z
  .object({
    holdId: z.string().uuid(),
    scopeType: z.enum(LEGAL_HOLD_SCOPE_TYPES),
    scopeId: z.string().uuid(),
    authorityReference: authorityReferenceSchema,
    createdAt: z.iso.datetime({ offset: true }),
    releasedAt: z.iso.datetime({ offset: true }).nullable(),
    releaseAuthorityReference: authorityReferenceSchema.nullable(),
  })
  .strict();

export type LegalHoldSummary = z.infer<typeof holdSummarySchema>;

export type LegalHoldStore = Readonly<{
  place(
    actorAuthUserId: string,
    input: z.infer<typeof placeInputSchema>,
  ): Promise<string>;
  release(
    actorAuthUserId: string,
    holdId: string,
    authorityReference: string,
  ): Promise<void>;
  list(
    actorAuthUserId: string,
    options: Readonly<{ includeReleased: boolean; limit: number }>,
  ): Promise<unknown>;
}>;

export type LegalHoldMutationResult =
  | Readonly<{ status: "placed"; holdId: string }>
  | Readonly<{ status: "released" }>
  | Readonly<{ status: "invalid_input" | "denied" | "failed" }>;

export async function placeLegalHold(
  input: unknown,
  dependencies: Readonly<{
    authorization: AdminActionAuthorization;
    store: LegalHoldStore;
  }>,
): Promise<LegalHoldMutationResult> {
  const parsed = placeInputSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid_input" };
  const authorization = await dependencies.authorization.consume();
  if (!authorization) return { status: "denied" };

  try {
    const holdId = await dependencies.store.place(
      authorization.actorAuthUserId,
      parsed.data,
    );
    return z.string().uuid().safeParse(holdId).success
      ? { status: "placed", holdId }
      : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}

export async function releaseLegalHold(
  input: unknown,
  dependencies: Readonly<{
    authorization: AdminActionAuthorization;
    store: LegalHoldStore;
  }>,
): Promise<LegalHoldMutationResult> {
  const parsed = releaseInputSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid_input" };
  const authorization = await dependencies.authorization.consume();
  if (!authorization) return { status: "denied" };

  try {
    await dependencies.store.release(
      authorization.actorAuthUserId,
      parsed.data.holdId,
      parsed.data.authorityReference,
    );
    return { status: "released" };
  } catch {
    return { status: "failed" };
  }
}

export type ListLegalHoldsResult =
  | Readonly<{ kind: "listed"; holds: readonly LegalHoldSummary[] }>
  | Readonly<{ kind: "denied" }>
  | Readonly<{ kind: "unavailable" }>;

/** Returns a bounded same-facility register after a current admin check. */
export async function listLegalHoldsForCurrentSession(
  client: CurrentSessionClient,
  store: LegalHoldStore,
  options: Readonly<{ includeReleased: boolean; limit: number }>,
): Promise<ListLegalHoldsResult> {
  const session = await authorizeCurrentSession(client, {
    requiredRole: "administrator",
  });
  if (!session.allowed) return { kind: "denied" };
  if (
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    options.limit > 200
  )
    return { kind: "unavailable" };

  try {
    const parsed = z
      .array(holdSummarySchema)
      .safeParse(await store.list(session.account.authUserId, options));
    return parsed.success
      ? { kind: "listed", holds: parsed.data }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
