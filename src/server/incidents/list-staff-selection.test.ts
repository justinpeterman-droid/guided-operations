import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listStaffSelectionForCurrentSession } from "./list-staff-selection";

const current = {
  staff_member_id: "11111111-1111-4111-8111-111111111111",
  display_name: "Fictional Preparer",
  employee_number_hint: "11",
  shift_code: "A",
  is_current_account: true,
};

function client(data: unknown) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: {
            sub: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            session_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            app_metadata: { auth_version: 1 },
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (name: string) =>
      name === "current_account"
        ? {
            data: [
              {
                auth_user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                facility_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                shift_code: "A",
                role: "officer",
                status: "active",
                auth_version: 1,
                must_change_passcode: false,
              },
            ],
            error: null,
          }
        : { data, error: null },
    ),
  };
}

describe("listStaffSelectionForCurrentSession", () => {
  it("maps one minimal roster and identifies the current preparer", async () => {
    const dependency = client([current]);

    await expect(
      listStaffSelectionForCurrentSession(dependency, 100),
    ).resolves.toEqual({
      kind: "listed",
      staff: [
        {
          staffMemberId: current.staff_member_id,
          displayName: current.display_name,
          employeeNumberHint: current.employee_number_hint,
          shiftCode: current.shift_code,
          isCurrentAccount: true,
        },
      ],
    });
    expect(dependency.rpc).toHaveBeenLastCalledWith("list_staff_selection", {
      p_limit: 100,
    });
  });

  it("fails closed when the roster cannot identify exactly one current account", async () => {
    await expect(
      listStaffSelectionForCurrentSession(client([]), 100),
    ).resolves.toEqual({ kind: "unavailable" });
    await expect(
      listStaffSelectionForCurrentSession(
        client([
          current,
          {
            ...current,
            staff_member_id: "22222222-2222-4222-8222-222222222222",
          },
        ]),
        100,
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
