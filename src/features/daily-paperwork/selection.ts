import { z } from "zod";

import { shiftCodeSchema, type ShiftCode } from "./catalog";

export function resolveDailyPaperworkSelection(
  searchParams: Record<string, string | string[] | undefined>,
  defaultWorkDate: string,
): Readonly<{ workDate: string; shiftCode: ShiftCode }> | null {
  const requestedWorkDate = single(searchParams.workDate);
  const requestedShift = single(searchParams.shiftCode);
  if (requestedWorkDate === null || requestedShift === null) return null;

  const workDateCandidate = requestedWorkDate ?? defaultWorkDate;
  const shiftCandidate = requestedShift ?? "A";
  const parsed = z
    .object({ workDate: z.iso.date(), shiftCode: shiftCodeSchema })
    .strict()
    .safeParse({ workDate: workDateCandidate, shiftCode: shiftCandidate });
  return parsed.success ? parsed.data : null;
}

function single(
  value: string | string[] | undefined,
): string | undefined | null {
  if (!Array.isArray(value)) return value;
  return value.length === 1 ? value[0] : null;
}
