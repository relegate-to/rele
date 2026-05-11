use std::path::Path as StdPath;
use std::sync::LazyLock;
use std::time::{Duration, Instant};

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use parking_lot::RwLock;
use regex::Regex;
use serde::{Deserialize, Serialize};
use tokio::fs;

use crate::config::AppState;

const CACHE_TTL: Duration = Duration::from_secs(5);

// ── SkillMeta types ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Deserialize)]
pub struct SkillRequires {
    #[serde(default)]
    pub bins: Vec<String>,
    #[serde(default)]
    pub any_bins: Vec<String>,
    #[serde(default)]
    pub env: Vec<String>,
    #[serde(default)]
    pub config: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InstallEntry {
    pub id: String,
    pub kind: String,
    pub label: String,
    #[serde(default)]
    pub bins: Vec<String>,
    pub formula: Option<String>,
    pub package: Option<String>,
    pub module: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct SkillMeta {
    pub name: Option<String>,
    pub description: Option<String>,
    pub emoji: Option<String>,
    pub always: bool,
    pub os: Vec<String>,
    pub primary_env: Option<String>,
    pub requires: SkillRequires,
    pub install: Vec<InstallEntry>,
}

// ── Frontmatter parsing ──────────────────────────────────────────────────────

static FM_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?s)^---\r?\n(.*?)\r?\n---").unwrap());

fn parse_scalar(s: &str) -> serde_json::Value {
    let v = s.trim().trim_end_matches(',').trim();
    if v.is_empty() {
        return serde_json::Value::String(String::new());
    }
    if (v.starts_with('"') && v.ends_with('"')) || (v.starts_with('\'') && v.ends_with('\'')) {
        return serde_json::Value::String(v[1..v.len() - 1].to_string());
    }
    match v {
        "true" => return serde_json::Value::Bool(true),
        "false" => return serde_json::Value::Bool(false),
        "null" | "~" => return serde_json::Value::Null,
        _ => {}
    }
    if let Ok(n) = v.parse::<f64>() {
        if let Some(num) = serde_json::Number::from_f64(n) {
            return serde_json::Value::Number(num);
        }
    }
    serde_json::Value::String(v.to_string())
}

fn extract_array(fm: &str, key: &str) -> Vec<String> {
    let inline_pat = format!(r#""?{}"?:\s*\[([^\]]*)\]"#, regex::escape(key));
    if let Ok(re) = Regex::new(&inline_pat) {
        if let Some(c) = re.captures(fm) {
            let inner = c.get(1).unwrap().as_str().trim();
            if inner.is_empty() {
                return Vec::new();
            }
            return inner
                .split(',')
                .map(|s| match parse_scalar(s.trim()) {
                    serde_json::Value::String(s) => Some(s),
                    serde_json::Value::Null => None,
                    v => Some(v.to_string()),
                })
                .filter_map(|s| s)
                .filter(|s| !s.is_empty())
                .collect();
        }
    }

    // Multi-line YAML-style list:
    //   key:
    //     - item
    let key_line_pat = format!(r#"(?m)^(\s*)"?{}"?:\s*$"#, regex::escape(key));
    let Ok(re) = Regex::new(&key_line_pat) else {
        return Vec::new();
    };
    let Some(m) = re.find(fm) else {
        return Vec::new();
    };
    let line_start_indent = re.captures(fm).unwrap().get(1).unwrap().as_str().len();
    let after = &fm[m.end()..];
    let mut items = Vec::new();
    for line in after.split('\n').skip(1) {
        if line.trim().is_empty() {
            continue;
        }
        let indent = line.chars().take_while(|c| c.is_whitespace()).count();
        if indent <= line_start_indent {
            break;
        }
        if let Some(rest) = line.trim_start().strip_prefix("- ") {
            match parse_scalar(rest) {
                serde_json::Value::String(s) if !s.is_empty() => items.push(s),
                _ => {}
            }
        }
    }
    items
}

fn extract_metadata_openclaw(fm: &str) -> Option<serde_json::Value> {
    let meta_idx = fm.find("metadata:")?;
    let after = &fm[meta_idx..];
    let brace_start = after.find('{')?;
    let bytes = after.as_bytes();
    let mut depth = 0i32;
    let mut i = brace_start;
    while i < bytes.len() {
        match bytes[i] {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    break;
                }
            }
            _ => {}
        }
        i += 1;
    }
    let raw = &after[brace_start..=i];

    // Strip trailing commas before ] or } so JSON.parse accepts it.
    static TRAILING_COMMA: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r",(\s*[}\]])").unwrap());
    let clean = TRAILING_COMMA.replace_all(raw, "$1");
    let parsed: serde_json::Value = serde_json::from_str(&clean).ok()?;
    parsed.get("openclaw").cloned()
}

pub fn parse_frontmatter(content: &str) -> SkillMeta {
    let Some(caps) = FM_RE.captures(content) else {
        return SkillMeta::default();
    };
    let fm = caps.get(1).unwrap().as_str();

    let scalar = |key: &str| -> Option<String> {
        let pat = format!(r"(?m)^{}:\s*(.+)$", regex::escape(key));
        let re = Regex::new(&pat).ok()?;
        let c = re.captures(fm)?;
        match parse_scalar(c.get(1)?.as_str().trim()) {
            serde_json::Value::String(s) if !s.is_empty() => Some(s),
            _ => None,
        }
    };

    let openclaw = extract_metadata_openclaw(fm).unwrap_or(serde_json::Value::Null);

    let openclaw_str = |key: &str| -> Option<String> {
        openclaw
            .get(key)
            .and_then(|v| v.as_str().map(|s| s.to_string()))
    };
    let openclaw_bool = |key: &str| -> bool {
        openclaw.get(key).and_then(|v| v.as_bool()).unwrap_or(false)
    };
    let openclaw_str_array = |key: &str| -> Vec<String> {
        openclaw
            .get(key)
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default()
    };

    let requires_node = openclaw.get("requires");
    let requires_bins = requires_node
        .and_then(|n| n.get("bins"))
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_else(|| extract_array(fm, "bins"));
    let requires_any_bins = requires_node
        .and_then(|n| n.get("anyBins"))
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    let requires_env = requires_node
        .and_then(|n| n.get("env"))
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    let requires_config = requires_node
        .and_then(|n| n.get("config"))
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_else(|| extract_array(fm, "config"));

    let install: Vec<InstallEntry> = openclaw
        .get("install")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| serde_json::from_value(v.clone()).ok())
                .collect()
        })
        .unwrap_or_default();

    SkillMeta {
        name: scalar("name"),
        description: scalar("description"),
        emoji: openclaw_str("emoji"),
        always: openclaw_bool("always"),
        os: openclaw_str_array("os"),
        primary_env: openclaw_str("primaryEnv"),
        requires: SkillRequires {
            bins: requires_bins,
            any_bins: requires_any_bins,
            env: requires_env,
            config: requires_config,
        },
        install,
    }
}

pub async fn load_skill_meta(dir: &StdPath) -> anyhow::Result<SkillMeta> {
    let content = fs::read_to_string(dir.join("SKILL.md")).await?;
    Ok(parse_frontmatter(&content))
}

// ── Bin / env / config checks ────────────────────────────────────────────────

fn check_bin(bin: &str) -> bool {
    let path = match std::env::var("PATH") {
        Ok(p) => p,
        Err(_) => return false,
    };
    for dir in path.split(':') {
        let candidate = StdPath::new(dir).join(bin);
        if candidate.is_file() {
            return true;
        }
    }
    false
}

fn get_nested<'a>(v: &'a serde_json::Value, path: &str) -> Option<&'a serde_json::Value> {
    let mut cur = v;
    for k in path.split('.') {
        cur = cur.get(k)?;
    }
    Some(cur)
}

// ── Skill output type ────────────────────────────────────────────────────────

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum SkillStatus {
    Ready,
    MissingDeps,
    NeedsConfig,
    Disabled,
}

#[derive(Serialize, Debug, Clone)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub emoji: Option<String>,
    pub enabled: bool,
    pub status: SkillStatus,
    #[serde(rename = "missingBins")]
    pub missing_bins: Vec<String>,
    #[serde(rename = "missingAnyBins")]
    pub missing_any_bins: Vec<String>,
    #[serde(rename = "missingEnv")]
    pub missing_env: Vec<String>,
    #[serde(rename = "missingConfig")]
    pub missing_config: Vec<String>,
    #[serde(rename = "pluginConfig")]
    pub plugin_config: Option<serde_json::Value>,
    #[serde(rename = "installEntries")]
    pub install_entries: Vec<InstallEntryOut>,
}

#[derive(Serialize, Debug, Clone)]
pub struct InstallEntryOut {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub bins: Vec<String>,
}

// ── Load a skill from a directory ────────────────────────────────────────────

async fn load_skill(
    skill_id: &str,
    dir: &StdPath,
    config: &serde_json::Value,
) -> Option<Skill> {
    let meta = load_skill_meta(dir).await.ok()?;

    let plugin_config = get_nested(config, &format!("plugins.entries.{}", skill_id)).cloned();
    let skill_entry = get_nested(config, &format!("skills.entries.{}", skill_id))
        .cloned()
        .unwrap_or(serde_json::Value::Object(Default::default()));

    let name = meta.name.clone().unwrap_or_else(|| skill_id.to_string());

    let base = Skill {
        id: skill_id.to_string(),
        name,
        description: meta.description.clone(),
        emoji: meta.emoji.clone(),
        enabled: true,
        status: SkillStatus::Ready,
        missing_bins: vec![],
        missing_any_bins: vec![],
        missing_env: vec![],
        missing_config: vec![],
        plugin_config,
        install_entries: vec![],
    };

    // `always: true` — skip all gates.
    if meta.always {
        return Some(base);
    }

    // OS gate.
    let current_os = match std::env::consts::OS {
        "macos" => "darwin",
        other => other,
    };
    if !meta.os.is_empty() && !meta.os.iter().any(|o| o == current_os) {
        return Some(Skill {
            enabled: false,
            status: SkillStatus::Disabled,
            ..base
        });
    }

    // Config-level enabled flag.
    if skill_entry.get("enabled").and_then(|v| v.as_bool()) == Some(false) {
        return Some(Skill {
            enabled: false,
            status: SkillStatus::Disabled,
            ..base
        });
    }

    // Bin checks.
    let missing_bins: Vec<String> = meta
        .requires
        .bins
        .iter()
        .filter(|b| !check_bin(b))
        .cloned()
        .collect();

    let any_bin_met = meta.requires.any_bins.is_empty()
        || meta.requires.any_bins.iter().any(|b| check_bin(b));
    let missing_any_bins: Vec<String> = if any_bin_met {
        vec![]
    } else {
        meta.requires.any_bins.clone()
    };

    // Env checks.
    let missing_env: Vec<String> = meta
        .requires
        .env
        .iter()
        .filter(|name| {
            if std::env::var(name).is_ok() {
                return false;
            }
            if skill_entry
                .get("env")
                .and_then(|e| e.get(name.as_str()))
                .is_some()
            {
                return false;
            }
            if meta.primary_env.as_deref() == Some(name.as_str())
                && skill_entry.get("apiKey").is_some()
            {
                return false;
            }
            true
        })
        .cloned()
        .collect();

    // Config path checks.
    let missing_config: Vec<String> = meta
        .requires
        .config
        .iter()
        .filter(|p| get_nested(config, p).is_none())
        .cloned()
        .collect();

    let status = if !missing_bins.is_empty() || !missing_any_bins.is_empty() {
        SkillStatus::MissingDeps
    } else if !missing_config.is_empty() || !missing_env.is_empty() {
        SkillStatus::NeedsConfig
    } else {
        SkillStatus::Ready
    };

    // Surface only install entries that address at least one missing bin.
    let all_missing: Vec<&String> = missing_bins.iter().chain(missing_any_bins.iter()).collect();
    let install_entries: Vec<InstallEntryOut> = meta
        .install
        .iter()
        .filter(|e| !e.id.is_empty() && !e.kind.is_empty() && !e.label.is_empty())
        .filter(|e| {
            e.bins.is_empty() || e.bins.iter().any(|b| all_missing.iter().any(|m| *m == b))
        })
        .map(|e| InstallEntryOut {
            id: e.id.clone(),
            kind: e.kind.clone(),
            label: e.label.clone(),
            bins: e.bins.clone(),
        })
        .collect();

    Some(Skill {
        missing_bins,
        missing_any_bins,
        missing_env,
        missing_config,
        status,
        install_entries,
        ..base
    })
}

// ── Cache ────────────────────────────────────────────────────────────────────

pub struct SkillsCache {
    inner: RwLock<Option<(Vec<Skill>, Instant)>>,
}

impl SkillsCache {
    pub fn new() -> Self {
        Self {
            inner: RwLock::new(None),
        }
    }

    pub fn invalidate(&self) {
        *self.inner.write() = None;
    }

    fn get(&self) -> Option<Vec<Skill>> {
        let g = self.inner.read();
        let (skills, at) = g.as_ref()?;
        if at.elapsed() < CACHE_TTL {
            Some(skills.clone())
        } else {
            None
        }
    }

    fn put(&self, v: Vec<Skill>) {
        *self.inner.write() = Some((v, Instant::now()));
    }
}

// ── Listing ──────────────────────────────────────────────────────────────────

async fn list_dir_skills(
    dir: &StdPath,
    config: &serde_json::Value,
    seen: &mut std::collections::HashSet<String>,
    force_disabled: bool,
) -> Vec<Skill> {
    let mut out = Vec::new();
    let Ok(mut rd) = fs::read_dir(dir).await else {
        return out;
    };
    while let Ok(Some(entry)) = rd.next_entry().await {
        let name = entry.file_name();
        let name_str = name.to_string_lossy().to_string();
        if name_str.starts_with('.') && !force_disabled {
            continue;
        }
        if name_str.starts_with('.') && force_disabled {
            continue; // don't recurse into .disabled inside .disabled
        }
        if seen.contains(&name_str) {
            continue;
        }
        let ft = match entry.file_type().await {
            Ok(f) => f,
            Err(_) => continue,
        };
        if !ft.is_dir() {
            continue;
        }
        if let Some(mut s) = load_skill(&name_str, &entry.path(), config).await {
            if force_disabled {
                s.enabled = false;
                s.status = SkillStatus::Disabled;
            }
            seen.insert(name_str);
            out.push(s);
        }
    }
    out
}

pub async fn list_skills(state: &AppState, config: &serde_json::Value) -> Vec<Skill> {
    if let Some(v) = state.skills_cache.get() {
        return v;
    }

    let mut skills = Vec::new();
    let mut seen = std::collections::HashSet::new();

    skills.extend(list_dir_skills(&state.config.skills_dir, config, &mut seen, false).await);
    skills.extend(
        list_dir_skills(&state.config.workspace_skills_dir, config, &mut seen, false).await,
    );
    skills.extend(list_dir_skills(&state.config.disabled_dir(), config, &mut seen, true).await);

    // Sort: enabled first, then alphabetical by name.
    skills.sort_by(|a, b| match (a.enabled, b.enabled) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    state.skills_cache.put(skills.clone());
    skills
}

// ── Move with EXDEV fallback ─────────────────────────────────────────────────

async fn move_dir(src: &StdPath, dst: &StdPath) -> std::io::Result<()> {
    match fs::rename(src, dst).await {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::CrossesDevices => {
            copy_dir_recursive(src, dst).await?;
            fs::remove_dir_all(src).await
        }
        Err(e) => Err(e),
    }
}

fn copy_dir_recursive<'a>(
    src: &'a StdPath,
    dst: &'a StdPath,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = std::io::Result<()>> + Send + 'a>> {
    Box::pin(async move {
        fs::create_dir_all(dst).await?;
        let mut rd = fs::read_dir(src).await?;
        while let Some(entry) = rd.next_entry().await? {
            let ft = entry.file_type().await?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            if ft.is_dir() {
                copy_dir_recursive(&src_path, &dst_path).await?;
            } else {
                fs::copy(&src_path, &dst_path).await?;
            }
        }
        Ok(())
    })
}

// ── Handlers ─────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ListBody {
    #[serde(default)]
    config: Option<serde_json::Value>,
}

pub async fn list_handler(State(state): State<AppState>) -> impl IntoResponse {
    let skills = list_skills(&state, &serde_json::Value::Object(Default::default())).await;
    axum::Json(serde_json::json!({ "skills": skills }))
}

pub async fn list_with_config_handler(
    State(state): State<AppState>,
    axum::Json(body): axum::Json<ListBody>,
) -> impl IntoResponse {
    let cfg = body.config.unwrap_or(serde_json::Value::Object(Default::default()));
    let skills = list_skills(&state, &cfg).await;
    axum::Json(serde_json::json!({ "skills": skills }))
}

pub async fn enable_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let src = state.config.disabled_dir().join(&id);
    let dst = state.config.skills_dir.join(&id);
    move_dir(&src, &dst)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to enable skill: {}", e)))?;
    state.skills_cache.invalidate();
    Ok(axum::Json(serde_json::json!({ "ok": true })))
}

pub async fn disable_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    fs::create_dir_all(state.config.disabled_dir())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let src = state.config.skills_dir.join(&id);
    let dst = state.config.disabled_dir().join(&id);
    move_dir(&src, &dst)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to disable skill: {}", e)))?;
    state.skills_cache.invalidate();
    Ok(axum::Json(serde_json::json!({ "ok": true })))
}

// ── Gateway restart ──────────────────────────────────────────────────────────

pub async fn gateway_restart_handler(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    use nix::sys::signal::{Signal, kill};
    use nix::unistd::Pid;
    use tokio::process::Command;

    let out = Command::new("pgrep")
        .args(["-a", "-f", "openclaw"])
        .output()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let text = String::from_utf8_lossy(&out.stdout);
    let me = std::process::id() as i32;
    for line in text.lines() {
        let pid_str = line.split_whitespace().next().unwrap_or("");
        let Ok(pid) = pid_str.parse::<i32>() else {
            continue;
        };
        if pid == 0 || pid == me {
            continue;
        }
        if let Err(e) = kill(Pid::from_raw(pid), Signal::SIGUSR1) {
            tracing::warn!("failed to signal pid {}: {}", pid, e);
        }
    }

    state.skills_cache.invalidate();
    Ok((StatusCode::ACCEPTED, axum::Json(serde_json::json!({ "ok": true }))))
}

