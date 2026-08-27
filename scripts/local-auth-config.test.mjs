import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

function sectionBody(source, section) {
  const body = [];
  let active = false;

  for (const line of source.split(/\r?\n/)) {
    const header = line.match(/^\[([^\]]+)]\s*$/);
    if (header) {
      if (active) break;
      active = header[1] === section;
      continue;
    }
    if (active) body.push(line);
  }

  return active ? body.join("\n") : null;
}

function settingInSection(source, section, setting) {
  const body = sectionBody(source, section);
  if (body === null) return null;
  const settingMatch = body.match(
    new RegExp(`^${setting}\\s*=\\s*(true|false)\\s*$`, "m"),
  );
  return settingMatch?.[1] ?? null;
}

describe("local private password sign-in configuration", () => {
  it("keeps public signup disabled while the staff password provider is enabled", async () => {
    const config = await readFile(
      new URL("../supabase/config.toml", import.meta.url),
      "utf8",
    );

    assert.equal(settingInSection(config, "auth", "enable_signup"), "false");
    assert.equal(
      settingInSection(config, "auth.email", "enable_signup"),
      "true",
    );
  });
});
