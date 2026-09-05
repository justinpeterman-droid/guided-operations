import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => null,
  useRouter: () => ({ refresh: vi.fn() }),
}));

import type { DailyPaperworkTemplatePackageSummary } from "@/server/paperwork/list-daily-paperwork-template-packages";

import { DailyPaperworkPackageManager } from "./daily-paperwork-package-manager";

const currentPackage: DailyPaperworkTemplatePackageSummary = {
  packageId: "00000000-0000-4000-8000-000000000010",
  packageDigest: "b".repeat(64),
  mappingVersion: "daily-paperwork-source-to-form-v1",
  sourceAuthority: "Fictional training records owner",
  sourceRevision: "fictional-revision-1",
  activeFrom: "2026-09-01",
  rollbackOfPackageDigest: null,
  sourceCount: 6,
  totalSourceBytes: 4096,
  approvedAt: "2026-08-28T18:00:00+00:00",
};

const filenames = [
  "assignment_roster.json",
  "uniform_inspection.json",
  "metal_detector_test.json",
  "perimeter_check.json",
  "random_search_log.json",
  "detector_sign_out.json",
];

afterEach(cleanup);

describe("DailyPaperworkPackageManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("crypto", {
      randomUUID: () => "fixture-idempotency-key-0001",
    });
  });

  it("keeps every package control inert in the fictional preview", () => {
    render(
      <DailyPaperworkPackageManager packages={[currentPackage]} preview />,
    );

    expect(
      screen.getByRole("button", { name: "Review package" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Six approved JSON files")).toBeDisabled();
    expect(screen.getByText(/Fictional visual preview/)).toBeInTheDocument();
    expect(screen.getByText("fictional-revision-1")).toBeInTheDocument();
  });

  it("reviews the exact six files before requesting a package-bound step-up", async () => {
    const user = userEvent.setup();
    const digest = "a".repeat(64);
    const entries = filenames.map((filename, index) => ({
      kind: filename.replace(".json", ""),
      sourceByteLength: 100 + index,
      sourceSha256: String(index + 1).repeat(64),
      mappedSha256: String(index + 2).repeat(64),
    }));
    const responses = [
      jsonResponse({ csrfToken: "csrf-token" }),
      jsonResponse({
        data: {
          evidence: {
            mappingVersion: "daily-paperwork-source-to-form-v1",
            packageDigest: digest,
            sourceCount: 6,
            totalBytes: 615,
            entries,
          },
        },
      }),
      jsonResponse({ csrfToken: "fresh-csrf-token" }),
      jsonResponse({
        data: { requestId: crypto.randomUUID(), token: "proof-token" },
      }),
      jsonResponse(
        {
          data: {
            packageId: crypto.randomUUID(),
            evidence: { packageDigest: digest },
          },
        },
        201,
      ),
    ];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => responses.shift() ?? jsonResponse({}, 500),
      );

    render(<DailyPaperworkPackageManager packages={[currentPackage]} />);
    await user.type(
      screen.getByLabelText("Source authority"),
      "Fictional authority",
    );
    await user.type(
      screen.getByLabelText("Source revision"),
      "FICTIONAL-REVISION-02",
    );
    fireEvent.change(screen.getByLabelText("Active date"), {
      target: { value: "2026-10-01" },
    });
    await user.upload(
      screen.getByLabelText("Six approved JSON files"),
      filenames.map(
        (filename) => new File(["{}"], filename, { type: "application/json" }),
      ),
    );

    fireEvent.submit(
      screen.getByRole("button", { name: "Review package" }).closest("form")!,
    );
    expect(
      await screen.findByRole("heading", {
        name: "Review passed for all six forms",
      }),
    ).toBeInTheDocument();

    const reviewRequest = fetchMock.mock.calls[1];
    expect(reviewRequest[0]).toBe(
      "/api/admin/daily-paperwork-template-package",
    );
    const reviewBody = (reviewRequest[1] as RequestInit).body as FormData;
    expect(reviewBody.get("action")).toBe("validate");
    expect(reviewBody.get("expectedCurrentPackageDigest")).toBe(
      currentPackage.packageDigest,
    );
    expect(reviewBody.getAll("files")).toHaveLength(6);
    expect(screen.getByLabelText("Source authority")).toBeDisabled();

    await user.type(
      screen.getByLabelText("Your administrator passcode"),
      "FictionalPasscode9!",
    );
    await user.click(
      screen.getByRole("button", { name: "Register approved package" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    const stepUpOptions = fetchMock.mock.calls[3][1] as RequestInit;
    expect(JSON.parse(String(stepUpOptions.body))).toEqual({
      action: "import",
      passcode: "FictionalPasscode9!",
      packageDigest: digest,
    });
    const registerOptions = fetchMock.mock.calls[4][1] as RequestInit;
    expect((registerOptions.body as FormData).get("action")).toBe("register");
    expect(
      (registerOptions.headers as Record<string, string>)["Idempotency-Key"],
    ).toBe("fixture-idempotency-key-0001");
    expect(screen.getByLabelText("Source authority")).toHaveValue("");
    expect(
      (screen.getByLabelText("Six approved JSON files") as HTMLInputElement)
        .files,
    ).toHaveLength(0);
  });

  it("reuses the reviewed package idempotency key after a lost response", async () => {
    const user = userEvent.setup();
    const digest = "c".repeat(64);
    const stableKey = "stable-reviewed-package-key-0001";
    const randomUUID = vi.fn(() => stableKey);
    vi.stubGlobal("crypto", { randomUUID });
    const evidence = {
      mappingVersion: "daily-paperwork-source-to-form-v1",
      packageDigest: digest,
      sourceCount: 6,
      totalBytes: 12,
      entries: filenames.map((filename, index) => ({
        kind: filename.replace(".json", ""),
        sourceByteLength: 2,
        sourceSha256: String(index + 1).repeat(64),
        mappedSha256: String(index + 2).repeat(64),
      })),
    };
    const responses = [
      jsonResponse({ csrfToken: "review-csrf" }),
      jsonResponse({ data: { evidence } }),
      jsonResponse({ csrfToken: "first-register-csrf" }),
      jsonResponse({ data: { requestId: "proof-1", token: "token-1" } }),
      jsonResponse({ error: "response_lost" }, 503),
      jsonResponse({ csrfToken: "retry-register-csrf" }),
      jsonResponse({ data: { requestId: "proof-2", token: "token-2" } }),
      jsonResponse({
        data: {
          packageId: "00000000-0000-4000-8000-000000000020",
          evidence: { packageDigest: digest },
        },
      }),
    ];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => responses.shift() ?? jsonResponse({}, 500),
      );

    render(<DailyPaperworkPackageManager packages={[currentPackage]} />);
    await user.type(screen.getByLabelText("Source authority"), "Authority");
    await user.type(screen.getByLabelText("Source revision"), "REVISION-03");
    fireEvent.change(screen.getByLabelText("Active date"), {
      target: { value: "2026-10-02" },
    });
    await user.upload(
      screen.getByLabelText("Six approved JSON files"),
      filenames.map(
        (filename) => new File(["{}"], filename, { type: "application/json" }),
      ),
    );
    fireEvent.submit(
      screen.getByRole("button", { name: "Review package" }).closest("form")!,
    );
    await screen.findByRole("heading", {
      name: "Review passed for all six forms",
    });
    await user.type(
      screen.getByLabelText("Your administrator passcode"),
      "FictionalPasscode9!",
    );

    await user.click(
      screen.getByRole("button", { name: "Register approved package" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    await user.click(
      screen.getByRole("button", { name: "Register approved package" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(8));

    const firstHeaders = fetchMock.mock.calls[4][1]?.headers as Record<
      string,
      string
    >;
    const retryHeaders = fetchMock.mock.calls[7][1]?.headers as Record<
      string,
      string
    >;
    expect(firstHeaders["Idempotency-Key"]).toBe(stableKey);
    expect(retryHeaders["Idempotency-Key"]).toBe(stableKey);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it("rejects a partial file selection before sending private source bodies", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<DailyPaperworkPackageManager packages={[]} />);

    await user.type(
      screen.getByLabelText("Source authority"),
      "Fictional authority",
    );
    await user.type(
      screen.getByLabelText("Source revision"),
      "FICTIONAL-REVISION-01",
    );
    fireEvent.change(screen.getByLabelText("Active date"), {
      target: { value: "2026-10-01" },
    });
    await user.upload(screen.getByLabelText("Six approved JSON files"), [
      new File(["{}"], filenames[0], { type: "application/json" }),
    ]);
    fireEvent.submit(
      screen.getByRole("button", { name: "Review package" }).closest("form")!,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "The package could not be completed. Nothing was registered.",
      ),
    ).toBeInTheDocument();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
