import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowedBinaryFiles = new Set([
  "docs/assets/zmind-plus-demo.mp4",
  "docs/assets/zmind-plus-demo.webm",
  "docs/assets/zmind-plus-poster.png",
]);

const checks = [
  {
    label: "credential-shaped value",
    pattern:
      /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/,
  },
  {
    label: "private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    label: "absolute workstation path",
    pattern:
      /(?:^|[\s"'`(])(?:\/(?:home|Users)\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[^\\\s]+\\)/m,
  },
];

const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const violations = [];

for (const filename of tracked) {
  const content = readFileSync(filename);
  if (content.includes(0)) {
    if (!allowedBinaryFiles.has(filename)) {
      violations.push(`${filename}: unexpected tracked binary`);
    }
    continue;
  }

  const text = content.toString("utf8");
  for (const check of checks) {
    if (check.pattern.test(text)) {
      violations.push(`${filename}: ${check.label}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Public repository boundary check failed:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `Public repository boundary: ${tracked.length} tracked files clean`,
);
