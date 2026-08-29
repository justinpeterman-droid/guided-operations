import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";

import { verifyRuntimeLogging } from "./verify-runtime-logging.mjs";

const workspaces = [];

afterEach(() => {
  for (const workspace of workspaces.splice(0))
    rmSync(workspace, { recursive: true, force: true });
});

describe("runtime logging boundary verifier", () => {
  it("accepts runtime code without direct output sinks", () => {
    const root = workspace();
    write(root, "src/app/api/fictional/route.ts", "export const value = 1;\n");
    assert.deepEqual(verifyRuntimeLogging({ projectRoot: root }), {
      ok: true,
      violations: [],
    });
  });

  it("rejects direct console and process output with value-free locations", () => {
    const root = workspace();
    write(
      root,
      "src/app/api/fictional/route.ts",
      'console.error("fictional-sensitive-value");\nprocess.stderr.write("bad");\n',
    );
    assert.deepEqual(verifyRuntimeLogging({ projectRoot: root }), {
      ok: false,
      violations: [
        { path: "src/app/api/fictional/route.ts", line: 1 },
        { path: "src/app/api/fictional/route.ts", line: 2 },
      ],
    });
  });

  it("permits only the strict operational-event sink and ignores test code", () => {
    const root = workspace();
    write(
      root,
      "src/server/observability/safe-operational-event.ts",
      "console.info(serializedEvent);\n",
    );
    write(
      root,
      "src/server/observability/example.test.ts",
      'console.log("fictional test output");\n',
    );
    assert.equal(verifyRuntimeLogging({ projectRoot: root }).ok, true);
  });
});

function workspace() {
  const root = mkdtempSync(join(tmpdir(), "guided-runtime-logging-"));
  mkdirSync(join(root, "src"));
  workspaces.push(root);
  return root;
}

function write(root, path, content) {
  const absolutePath = join(root, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
}
