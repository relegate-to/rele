import { readdir, readFile, rename, mkdir, cp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const SKILLS_DIR = process.env.SKILLS_DIR ?? "/app/skills";
const DISABLED_DIR = `${SKILLS_DIR}/.disabled`;

// ── YAML frontmatter ──────────────────────────────────────────────────────────
//
// Minimal parser — only extracts the fields SKILL.md is known to contain.
// Handles: top-level scalars, inline arrays (bins/config), and the nested
// metadata.openclaw subtree.

function parseScalar(s) {
  // Strip trailing comma (present in flow-style YAML: "emoji": "💎",)
  const v = s.trim().replace(/,\s*$/, "").trim();
  if (!v) return "";
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  )
    return v.slice(1, -1);
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null" || v === "~") return null;
  const n = Number(v);
  if (!isNaN(n) && v !== "") return n;
  return v;
}

function extractArray(fm, key) {
  // Keys may be quoted ("bins") or unquoted (bins) — handle both.
  // Inline form:  bins: ["curl"]  or  "bins": ["curl"]
  const inlineMatch = fm.match(new RegExp(`"?${key}"?:\\s*\\[([^\\]]*)\\]`));
  if (inlineMatch) {
    const inner = inlineMatch[1].trim();
    if (!inner) return [];
    return inner
      .split(",")
      .map((s) => parseScalar(s.trim()))
      .filter((s) => s !== "" && s !== null);
  }

  // Multi-line form:
  //   bins:        or   "bins":
  //     - curl             - curl
  const lines = fm.split("\n");
  const keyIdx = lines.findIndex((l) =>
    l.match(new RegExp(`^\\s*"?${key}"?:\\s*$`)),
  );
  if (keyIdx === -1) return [];

  const keyIndent = lines[keyIdx].match(/^(\s*)/)[1].length;
  const items = [];
  for (let i = keyIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const lineIndent = line.match(/^(\s*)/)[1].length;
    if (lineIndent <= keyIndent) break;
    const itemMatch = line.trim().match(/^-\s+(.+)$/);
    if (itemMatch) items.push(parseScalar(itemMatch[1]));
  }
  return items;
}

// Extract the `metadata:` block from frontmatter and JSON-parse it.
// SKILL.md uses flow-style YAML for metadata (looks like JSON with trailing
// commas), so we strip trailing commas and parse with JSON.parse.
function extractOpenclaw(fm) {
  const metaIdx = fm.indexOf("metadata:");
  if (metaIdx === -1) return null;
  const braceStart = fm.indexOf("{", metaIdx);
  if (braceStart === -1) return null;

  let depth = 0;
  let i = braceStart;
  while (i < fm.length) {
    if (fm[i] === "{") depth++;
    else if (fm[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }

  const raw = fm.slice(braceStart, i + 1);
  // Remove trailing commas before ] or } so JSON.parse accepts it.
  const clean = raw.replace(/,(\s*[}\]])/g, "$1");
  try {
    const parsed = JSON.parse(clean);
    return parsed?.openclaw ?? null;
  } catch {
    return null;
  }
}

function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = m[1];

  const scalar = (key) => {
    const r = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    if (!r) return undefined;
    return parseScalar(r[1].trim());
  };

  const openclaw = extractOpenclaw(fm);

  return {
    name: scalar("name"),
    description: scalar("description"),
    emoji: openclaw?.emoji ?? null,
    always: openclaw?.always ?? false,
    os: openclaw?.os ?? null,
    primaryEnv: openclaw?.primaryEnv ?? null,
    requires: {
      bins: openclaw?.requires?.bins ?? extractArray(fm, "bins"),
      anyBins: openclaw?.requires?.anyBins ?? [],
      env: openclaw?.requires?.env ?? [],
      config: openclaw?.requires?.config ?? extractArray(fm, "config"),
    },
    install: openclaw?.install ?? [],
  };
}

// ── Cache ─────────────────────────────────────────────────────────────────────

let _skillsCache = null;
let _skillsCacheExpiry = 0;
const CACHE_TTL = 5_000;

export function invalidateCache() {
  _skillsCache = null;
  _skillsCacheExpiry = 0;
}

function getNestedValue(obj, path) {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

// ── Skill loading ─────────────────────────────────────────────────────────────

function checkBin(bin) {
  return new Promise((resolve) => {
    const child = spawn("which", [bin], { stdio: "ignore" });
    child.on("close", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

async function loadSkill(skillId, dir, config) {
  let meta = {};
  try {
    const content = await readFile(`${dir}/SKILL.md`, "utf8");
    meta = parseFrontmatter(content);
  } catch {
    // No SKILL.md — not a valid skill directory.
    return null;
  }

  const pluginConfig = getNestedValue(config, `plugins.entries.${skillId}`) ?? null;
  const skillEntry  = getNestedValue(config, `skills.entries.${skillId}`) ?? {};

  const base = {
    id: skillId,
    name: meta.name ?? skillId,
    description: meta.description ?? null,
    emoji: meta.emoji ?? null,
    pluginConfig,
  };

  // `always: true` — skip all gates, always ready.
  if (meta.always) {
    return { ...base, enabled: true, status: "ready", missingBins: [], missingAnyBins: [], missingEnv: [], missingConfig: [], installEntries: [] };
  }

  // OS gate — if the skill declares a target OS list and we're not in it, mark disabled.
  if (meta.os && meta.os.length > 0 && !meta.os.includes(process.platform)) {
    return { ...base, enabled: false, status: "disabled", missingBins: [], missingAnyBins: [], missingEnv: [], missingConfig: [], installEntries: [] };
  }

  // Config-level enabled flag (skills.entries.<id>.enabled === false).
  if (skillEntry.enabled === false) {
    return { ...base, enabled: false, status: "disabled", missingBins: [], missingAnyBins: [], missingEnv: [], missingConfig: [], installEntries: [] };
  }

  const bins     = meta.requires?.bins    ?? [];
  const anyBins  = meta.requires?.anyBins ?? [];
  const envVars  = meta.requires?.env     ?? [];
  const configPaths = meta.requires?.config ?? [];

  // Check required bins and anyBins in parallel.
  const [binResults, anyBinResults] = await Promise.all([
    Promise.all(bins.map(async (bin) => ({ bin, ok: await checkBin(bin) }))),
    Promise.all(anyBins.map(async (bin) => ({ bin, ok: await checkBin(bin) }))),
  ]);

  const missingBins = binResults.filter((r) => !r.ok).map((r) => r.bin);

  // anyBins: need at least one present; if none are found, surface all as candidates.
  const anyBinMet   = anyBins.length === 0 || anyBinResults.some((r) => r.ok);
  const missingAnyBins = anyBinMet ? [] : anyBinResults.map((r) => r.bin);

  // Check env vars — satisfied if in process.env, skillEntry.env, or apiKey+primaryEnv.
  const missingEnv = envVars.filter((varName) => {
    if (process.env[varName]) return false;
    if (skillEntry.env?.[varName]) return false;
    if (meta.primaryEnv === varName && skillEntry.apiKey) return false;
    return true;
  });

  // Check config paths.
  const missingConfig = configPaths
    .filter((path) => !getNestedValue(config, path))
    .map((path) => path);

  let status = "ready";
  if (missingBins.length > 0 || missingAnyBins.length > 0) status = "missing-deps";
  else if (missingConfig.length > 0 || missingEnv.length > 0) status = "needs-config";

  // Only surface install entries that address at least one missing bin.
  const allMissingBins = [...missingBins, ...missingAnyBins];
  const installEntries = (meta.install ?? [])
    .filter((e) => e.id && e.kind && e.label)
    .map((e) => ({ id: e.id, kind: e.kind, label: e.label, bins: e.bins ?? [] }))
    .filter((e) => e.bins.length === 0 || e.bins.some((b) => allMissingBins.includes(b)));

  return {
    ...base,
    enabled: true,
    status,
    missingBins,
    missingAnyBins,
    missingEnv,
    missingConfig,
    installEntries,
  };
}

async function listSkills(config) {
  const now = Date.now();
  if (_skillsCache && now < _skillsCacheExpiry) return _skillsCache;

  config = config ?? {};
  const skills = [];

  // Enabled skills
  try {
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map(async (e) => {
          const skill = await loadSkill(
            e.name,
            `${SKILLS_DIR}/${e.name}`,
            config,
          );
          if (skill) skills.push(skill);
        }),
    );
  } catch {}

  // Disabled skills
  try {
    const entries = await readdir(DISABLED_DIR, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          const skill = await loadSkill(
            e.name,
            `${DISABLED_DIR}/${e.name}`,
            config,
          );
          if (skill) {
            skill.enabled = false;
            skill.status = "disabled";
            skills.push(skill);
          }
        }),
    );
  } catch {}

  // Stable order: enabled first, then alphabetical within each group.
  skills.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  _skillsCache = skills;
  _skillsCacheExpiry = now + CACHE_TTL;
  return skills;
}

// ── Install jobs ──────────────────────────────────────────────────────────────

const installJobs = new Map();

function buildInstallCommand(entry) {
  const pkg = entry.formula ?? entry.package ?? entry.module ?? entry.name;
  if (!pkg) return null;
  switch (entry.kind) {
    case "brew":    return `su linuxbrew -s /bin/bash -c "brew install ${pkg}"`;
    case "npm":
    case "node":    return `npm install -g ${pkg}`;
    case "pip":
    case "pip3":    return `pip3 install ${pkg}`;
    case "apt":
    case "apt-get": return `apt-get install -y ${pkg}`;
    case "cargo":   return `cargo install ${pkg}`;
    case "go":      return `go install ${pkg.includes("@") ? pkg : `${pkg}@latest`}`;
    case "apk":     return `apk add --no-cache ${pkg}`;
    default:        return null;
  }
}

// ── Filesystem move ───────────────────────────────────────────────────────────
//
// rename(2) fails with EXDEV when src and dest are on different devices/mounts
// (common in Docker where individual skill folders may be bind-mounted).
// Fall back to recursive copy + delete in that case.

async function moveDir(src, dest) {
  try {
    await rename(src, dest);
  } catch (err) {
    if (err.code !== "EXDEV") throw err;
    await cp(src, dest, { recursive: true });
    await rm(src, { recursive: true, force: true });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function jsonOk(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function jsonError(res, message, status = 500) {
  jsonOk(res, { error: message }, status);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function handleSkillsApi(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;
  const method = req.method;

  // GET or POST /api/skills
  if ((method === "GET" || method === "POST") && pathname === "/api/skills") {
    try {
      let config;
      if (method === "POST") {
        const body = await readBody(req);
        config = body.config;
      }
      const skills = await listSkills(config);
      return jsonOk(res, { skills });
    } catch (err) {
      console.error("[skills] list error:", err);
      return jsonError(res, "Failed to list skills");
    }
  }

  // POST /api/skills/:id/disable
  const disableMatch = pathname.match(/^\/api\/skills\/([^/]+)\/disable$/);
  if (method === "POST" && disableMatch) {
    const id = disableMatch[1];
    try {
      await mkdir(DISABLED_DIR, { recursive: true });
      await moveDir(`${SKILLS_DIR}/${id}`, `${DISABLED_DIR}/${id}`);
      invalidateCache();
      return jsonOk(res, { ok: true });
    } catch (err) {
      console.error("[skills] disable error:", err);
      return jsonError(res, `Failed to disable skill: ${err.message}`);
    }
  }

  // POST /api/skills/:id/enable
  const enableMatch = pathname.match(/^\/api\/skills\/([^/]+)\/enable$/);
  if (method === "POST" && enableMatch) {
    const id = enableMatch[1];
    try {
      await moveDir(`${DISABLED_DIR}/${id}`, `${SKILLS_DIR}/${id}`);
      invalidateCache();
      return jsonOk(res, { ok: true });
    } catch (err) {
      console.error("[skills] enable error:", err);
      return jsonError(res, `Failed to enable skill: ${err.message}`);
    }
  }

  // POST /api/skills/:id/install/:installId
  const installMatch = pathname.match(/^\/api\/skills\/([^/]+)\/install\/([^/]+)$/);
  if (method === "POST" && installMatch) {
    const [, skillId, installId] = installMatch;
    try {
      // Re-read skill meta directly (bypass cache so we have fresh install entries).
      const dir = `${SKILLS_DIR}/${skillId}`;
      const content = await readFile(`${dir}/SKILL.md`, "utf8");
      const meta = parseFrontmatter(content);
      const entry = (meta.install ?? []).find((e) => e.id === installId);
      if (!entry) return jsonError(res, "Install entry not found", 404);

      const cmd = buildInstallCommand(entry);
      if (!cmd) return jsonError(res, `Unsupported install kind: ${entry.kind}`, 400);

      const jobId = `${skillId}-${installId}-${Date.now()}`;
      const job = { status: "running", output: "", error: null };
      installJobs.set(jobId, job);

      const child = spawn("sh", ["-c", cmd], { env: process.env });
      child.stdout.on("data", (chunk) => { job.output += chunk.toString(); });
      child.stderr.on("data", (chunk) => { job.output += chunk.toString(); });
      child.on("close", (code) => {
        if (code === 0) { job.status = "done"; invalidateCache(); }
        else { job.error = `exited with code ${code}`; job.status = "error"; }
      });

      return jsonOk(res, { jobId }, 202);
    } catch (err) {
      console.error("[skills] install error:", err);
      return jsonError(res, `Failed to start install: ${err.message}`);
    }
  }

  // POST /api/gateway/restart
  if (method === "POST" && pathname === "/api/gateway/restart") {
    console.log("[skills] restart requested");
    try {
      const child = spawn("pgrep", ["-a", "-f", "openclaw"]);
      let output = "";
      child.stdout.on("data", (chunk) => { output += chunk.toString(); });
      child.stderr.on("data", (chunk) => { console.error("[skills] pgrep stderr:", chunk.toString().trim()); });
      child.on("close", (code) => {
        console.log(`[skills] pgrep exited ${code}, output:\n${output.trim() || "(empty)"}`);
        const lines = output.trim().split("\n").filter(Boolean);
        for (const line of lines) {
          const pid = parseInt(line, 10);
          if (!pid || pid === process.pid) continue;
          try {
            process.kill(pid, "SIGUSR1");
            console.log(`[skills] sent SIGUSR1 to pid ${pid}`);
          } catch (err) {
            console.error(`[skills] failed to signal pid ${pid}:`, err.message);
          }
        }
      });
      child.on("error", (err) => console.error("[skills] pgrep error:", err.message));
      invalidateCache();
      return jsonOk(res, { ok: true }, 202);
    } catch (err) {
      console.error("[skills] restart error:", err);
      return jsonError(res, `Failed to restart gateway: ${err.message}`);
    }
  }

  // GET /api/skills/install/:jobId
  const installStatusMatch = pathname.match(/^\/api\/skills\/install\/([^/]+)$/);
  if (method === "GET" && installStatusMatch) {
    const jobId = installStatusMatch[1];
    const job = installJobs.get(jobId);
    if (!job) return jsonError(res, "Job not found", 404);
    return jsonOk(res, job);
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}
