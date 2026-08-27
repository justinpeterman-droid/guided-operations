import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  encoding: "buffer",
})
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

const privateKeyMarker = [
  "-----BEGIN",
  "(?:RSA |EC |OPENSSH |)?PRIVATE",
  "KEY-----",
].join(" ");

const secretPatterns = [
  {
    label: "private key",
    pattern: new RegExp(privateKeyMarker),
  },
  {
    label: "OpenAI API key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    label: "GitHub token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  },
  {
    label: "Supabase secret key",
    pattern: /\bsb_secret_[A-Za-z0-9_-]{16,}\b/,
  },
  {
    label: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    label: "AWS access key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  },
  {
    label: "non-empty sensitive environment assignment",
    pattern:
      /^(?:[A-Z][A-Z0-9_]*?(?:SECRET|TOKEN|API_KEY|PASSWORD|PRIVATE_KEY|PEPPER))[ \t]*=[ \t]*(?![ \t]*(?:["']?(?:|changeme|example|replace-me|your-[^"'\s]+)["']?)[ \t]*$).+/m,
  },
];

const findings = [];

for (const file of trackedFiles) {
  // A tracked file can be intentionally deleted in the current worktree before
  // its deletion is staged. Scan the indexed copy in that case so a local
  // deletion cannot hide a secret that remains in the candidate commit.
  const content = existsSync(file)
    ? readFileSync(file, "utf8")
    : execFileSync("git", ["show", `:${file}`], { encoding: "utf8" });

  for (const { label, pattern } of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) findings.push(`${file}: ${label}`);
  }
}

if (findings.length > 0) {
  console.error("Potential committed secrets detected:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log("No tracked secret patterns detected.");
}
