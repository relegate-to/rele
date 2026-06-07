use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::Mutex as TokioMutex;
use tokio::process::Command;

use crate::config::AppState;
use crate::skills::{InstallEntry, load_skill_meta};

#[derive(Clone, Copy, Serialize, Debug)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Running,
    Done,
    Error,
}

#[derive(Serialize, Debug)]
pub struct InstallJob {
    pub status: JobStatus,
    pub output: String,
    pub error: Option<String>,
}

pub struct InstallJobs {
    jobs: Mutex<HashMap<String, Arc<TokioMutex<InstallJob>>>>,
}

impl InstallJobs {
    pub fn new() -> Self {
        Self {
            jobs: Mutex::new(HashMap::new()),
        }
    }

    pub fn insert(&self, id: String, job: Arc<TokioMutex<InstallJob>>) {
        self.jobs.lock().insert(id, job);
    }

    pub fn get(&self, id: &str) -> Option<Arc<TokioMutex<InstallJob>>> {
        self.jobs.lock().get(id).cloned()
    }
}

#[derive(Deserialize)]
pub struct StartInstallPath {
    id: String,
    install_id: String,
}

fn build_install_command(entry: &InstallEntry) -> Option<String> {
    let pkg = entry
        .formula
        .as_deref()
        .or(entry.package.as_deref())
        .or(entry.module.as_deref())
        .or(entry.name.as_deref())?;
    let cmd = match entry.kind.as_str() {
        "brew" => format!("brew install {}", pkg),
        "npm" | "node" => format!("npm install -g {}", pkg),
        "pip" | "pip3" => format!("pip3 install {}", pkg),
        "apt" | "apt-get" => format!("apt-get install -y {}", pkg),
        "cargo" => format!("cargo install {}", pkg),
        "go" => {
            if pkg.contains('@') {
                format!("go install {}", pkg)
            } else {
                format!("go install {}@latest", pkg)
            }
        }
        "apk" => format!("apk add --no-cache {}", pkg),
        _ => return None,
    };
    Some(cmd)
}

pub async fn start_install_handler(
    Path(StartInstallPath { id, install_id }): Path<StartInstallPath>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let dir = state.config.skills_dir.join(&id);
    let meta = load_skill_meta(&dir)
        .await
        .map_err(|e| (StatusCode::NOT_FOUND, format!("skill not found: {}", e)))?;

    let entry = meta
        .install
        .into_iter()
        .find(|e| e.id == install_id)
        .ok_or((StatusCode::NOT_FOUND, "Install entry not found".to_string()))?;

    let cmd = build_install_command(&entry).ok_or((
        StatusCode::BAD_REQUEST,
        format!("Unsupported install kind: {}", entry.kind),
    ))?;

    let job_id = format!("{}-{}-{}", id, install_id, uuid::Uuid::new_v4());
    let job = Arc::new(TokioMutex::new(InstallJob {
        status: JobStatus::Running,
        output: String::new(),
        error: None,
    }));
    state.install_jobs.insert(job_id.clone(), job.clone());

    let skills_cache = state.skills_cache.clone();
    tokio::spawn(async move {
        let mut child = match Command::new("sh")
            .arg("-c")
            .arg(&cmd)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                let mut j = job.lock().await;
                j.status = JobStatus::Error;
                j.error = Some(e.to_string());
                return;
            }
        };

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let job_out = job.clone();
        let stdout_task = tokio::spawn(async move {
            if let Some(out) = stdout {
                let mut reader = BufReader::new(out).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let mut j = job_out.lock().await;
                    j.output.push_str(&line);
                    j.output.push('\n');
                }
            }
        });
        let job_err = job.clone();
        let stderr_task = tokio::spawn(async move {
            if let Some(out) = stderr {
                let mut reader = BufReader::new(out).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let mut j = job_err.lock().await;
                    j.output.push_str(&line);
                    j.output.push('\n');
                }
            }
        });

        let status = child.wait().await;
        let _ = stdout_task.await;
        let _ = stderr_task.await;

        let mut j = job.lock().await;
        match status {
            Ok(s) if s.success() => {
                j.status = JobStatus::Done;
                skills_cache.invalidate();
            }
            Ok(s) => {
                j.status = JobStatus::Error;
                j.error = Some(format!("exited with code {}", s.code().unwrap_or(-1)));
            }
            Err(e) => {
                j.status = JobStatus::Error;
                j.error = Some(e.to_string());
            }
        }
    });

    Ok((StatusCode::ACCEPTED, axum::Json(serde_json::json!({ "jobId": job_id }))))
}

pub async fn poll_handler(
    Path(job_id): Path<String>,
    State(state): State<AppState>,
) -> Result<axum::Json<serde_json::Value>, StatusCode> {
    let job = state.install_jobs.get(&job_id).ok_or(StatusCode::NOT_FOUND)?;
    let j = job.lock().await;
    Ok(axum::Json(serde_json::json!({
        "status": j.status,
        "output": j.output,
        "error": j.error,
    })))
}
