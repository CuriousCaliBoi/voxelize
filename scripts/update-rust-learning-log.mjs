#!/usr/bin/env node
/**
 * AI-driven Rust learning log updater.
 *
 * Triggered by .husky/post-commit.
 *
 * What it does:
 * - Reads the latest commit metadata + diff
 * - Sends it (with current notes/rust-learning-log.md) to an LLM
 * - Writes back the updated markdown (Evidence Log + skill status updates)
 *
 * Configuration (OpenAI-compatible API):
 * - RUST_LOG_AI_BASE_URL (default: https://api.openai.com/v1)
 * - RUST_LOG_AI_API_KEY  (or OPENAI_API_KEY)
 * - RUST_LOG_AI_MODEL    (default: gpt-4o-mini)
 *
 * Notes:
 * - If no AI config is present or the AI call fails, the script falls back to a minimal deterministic update
 *   (still updates Evidence Log + bumps a few skill rows based on heuristics).
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
}

function safeSh(cmd) {
  try {
    return { ok: true, out: sh(cmd) };
  } catch (e) {
    return { ok: false, out: "", err: (e?.stderr?.toString?.() || e?.message || String(e)).trim() };
  }
}

function ensureTrailingNewline(s) {
  return s.endsWith("\n") ? s : s + "\n";
}

function truncate(s, maxChars) {
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + `\n\n[truncated ${s.length - maxChars} chars]\n`;
}

function insertEvidenceBullet(markdown, { date, subject, hashShort, changedFiles }) {
  const lines = markdown.split(/\r?\n/);

  const header = "## Evidence Log";
  let idx = lines.findIndex((l) => l.startsWith(header));
  if (idx === -1) {
    lines.push("");
    lines.push(header);
    idx = lines.length - 1;
  }

  let insertAt = idx + 1;
  while (insertAt < lines.length && lines[insertAt].trim() === "") insertAt += 1;

  const filesPart = changedFiles ? `; files: ${changedFiles}` : "";
  const bullet = `- ${date} — ${subject} (commit ${hashShort}${filesPart})`;
  lines.splice(insertAt, 0, bullet);

  return lines.join("\n");
}

function bumpTableStatus(markdown, concept, desired) {
  // Only bumps status, never downgrades ✅.
  // Table row format: | <Status> | <Concept> | <Evidence> |
  const lines = markdown.split(/\r?\n/);

  const order = { "⬜": 0, "⚙️": 1, "✅": 2 };
  const want = order[desired] ?? 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|")) continue;

    const parts = line.split("|").map((p) => p.trim());
    // parts: ["", status, concept, evidence, ""]
    if (parts.length < 5) continue;
    if (parts[2] !== concept) continue;

    const cur = parts[1];
    const curRank = order[cur] ?? 0;

    // Never downgrade ✅
    if (cur === "✅" && desired !== "✅") return lines.join("\n");

    if (curRank >= want) return lines.join("\n");

    parts[1] = desired;
    lines[i] = `| ${parts[1]} | ${parts[2]} | ${parts[3]} |`;
    return lines.join("\n");
  }

  return lines.join("\n");
}

function fallbackUpdate({ logText, date, subject, hashShort, changedList, diffText }) {
  // Minimal deterministic update (used only if AI isn't configured or fails).
  // Evidence bullet
  const changedFiles = changedList
    .split(/\r?\n/)
    .filter(Boolean)
    .join(",");

  let out = insertEvidenceBullet(logText, { date, subject, hashShort, changedFiles });

  // Lightweight skill bumps (never downgrades)
  out = bumpTableStatus(out, "Git: commit workflow & staging", "⚙️");

  if (changedList.includes(".husky/") || changedList.includes("scripts/update-rust-learning-log")) {
    out = bumpTableStatus(out, "Git: hooks automation", "⚙️");
  }

  if (changedList.includes(".cursor/")) {
    out = bumpTableStatus(out, "Cursor: rules & automation", "⚙️");
  }

  // Very small Rust heuristics
  if (/\bfn\s+\w+\s*\(/.test(diffText)) out = bumpTableStatus(out, "3.3 Functions", "⚙️");
  if (/\bstruct\s+\w+/.test(diffText)) out = bumpTableStatus(out, "5.1 Defining / instantiating structs", "⚙️");
  if (/\bmatch\b/.test(diffText)) out = bumpTableStatus(out, "6.2 match", "⚙️");
  if (/\bif\s+let\b|\blet\s+else\b/.test(diffText)) out = bumpTableStatus(out, "6.3 if let / let else", "⚙️");
  if (/\benum\s+\w+/.test(diffText)) out = bumpTableStatus(out, "6.1 Defining enums", "⚙️");
  if (/\blet\s+mut\b/.test(diffText)) out = bumpTableStatus(out, "3.1 Variables & mutability", "⚙️");
  if (/\/\/|\/\*|\*\//.test(diffText)) out = bumpTableStatus(out, "3.4 Comments", "⚙️");
  if (/\bfor\b|\bwhile\b|\bif\b/.test(diffText)) out = bumpTableStatus(out, "3.5 Control flow", "⚙️");

  return ensureTrailingNewline(out);
}

async function callOpenAICompatibleChat({ baseUrl, apiKey, model, messages }) {
  const url = baseUrl.replace(/\/$/, "") + "/chat/completions";
  const headers = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 1000)}`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`AI response not JSON: ${text.slice(0, 1000)}`);
  }

  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length < 20) {
    throw new Error("AI response missing content");
  }

  return content;
}

async function main() {
  const root = sh("git rev-parse --show-toplevel");
  const logFile = path.join(root, "notes", "rust-learning-log.md");

  if (!fs.existsSync(logFile)) {
    console.log(`[rust-log] no log file found at ${logFile}; skipping`);
    return;
  }

  const hashShort = sh("git rev-parse --short HEAD").trim();
  const date = sh("git log -1 --date=format:'%Y-%m-%d' --format=%ad").trim();
  const subject = sh("git log -1 --pretty=%s").trim();
  const changedList = sh("git diff-tree --no-commit-id --name-only -r HEAD");

  // Unified=0 keeps diffs small-ish. Still may be huge; truncate for prompt.
  const diffTextRaw = sh("git show --pretty=format: --unified=0 HEAD");
  const diffText = truncate(diffTextRaw, 120_000);

  const logText = fs.readFileSync(logFile, "utf8");

  if (logText.includes(hashShort)) {
    console.log(`[rust-log] entry for commit ${hashShort} already present; skipping`);
    return;
  }

  const baseUrl = process.env.RUST_LOG_AI_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const apiKey = process.env.RUST_LOG_AI_API_KEY || process.env.OPENAI_API_KEY || "";
  const model = process.env.RUST_LOG_AI_MODEL || "gpt-4o-mini";

  const changedFiles = changedList
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 200)
    .join(",");

  const prompt = {
    system: [
      "You update a single markdown file: notes/rust-learning-log.md.",
      "Your output MUST be the full updated markdown document (no commentary, no code fences).",
      "Goals:",
      "- Insert a new bullet at the TOP of the Evidence Log for the latest commit.",
      "- Update skill statuses (✅/⚙️/⬜) in the existing tables based on what the diff shows.",
      "Rules:",
      "- Never downgrade a ✅ to ⚙️ or ⬜.",
      "- Keep existing sections/formatting as much as possible.",
      "- Evidence bullet should be specific and mention the files/behavior.",
      "- If unsure, prefer ⚙️ over ✅.",
      "Optional tags in commit subject:",
      "- [skill:<tag>] => mark relevant concept as ⚙️",
      "- [skill:<tag>=solid] => mark relevant concept as ✅",
    ].join("\n"),
    user: [
      `Latest commit: ${hashShort}`,
      `Date: ${date}`,
      `Subject: ${subject}`,
      `Changed files: ${changedFiles || "(none)"}`,
      "---",
      "CURRENT LOG FILE:",
      logText,
      "---",
      "GIT DIFF (unified=0, may be truncated):",
      diffText,
    ].join("\n"),
  };

  let updated;
  const aiConfigured = Boolean(apiKey) || baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

  if (aiConfigured) {
    try {
      updated = await callOpenAICompatibleChat({
        baseUrl,
        apiKey,
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      });

      // Basic validation: must still contain Evidence Log and reference commit hash.
      if (!updated.includes("## Evidence Log") || !updated.includes(hashShort)) {
        throw new Error("AI output failed validation (missing Evidence Log or commit hash)");
      }

      fs.writeFileSync(logFile, ensureTrailingNewline(updated), "utf8");
      console.log(`[rust-log] AI-updated ${path.relative(root, logFile)} for commit ${hashShort}`);
      return;
    } catch (e) {
      console.warn(`[rust-log] AI update failed; falling back. Reason: ${e?.message || String(e)}`);
    }
  } else {
    console.warn("[rust-log] AI not configured (no API key / base URL); falling back to minimal updater");
  }

  const fallback = fallbackUpdate({ logText, date, subject, hashShort, changedList, diffText: diffTextRaw });
  fs.writeFileSync(logFile, fallback, "utf8");
  console.log(`[rust-log] fallback-updated ${path.relative(root, logFile)} for commit ${hashShort}`);
}

main().catch((e) => {
  console.warn(`[rust-log] failed: ${e?.message || String(e)}`);
  process.exit(0); // post-commit should never block workflow
});
