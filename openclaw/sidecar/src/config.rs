use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use tokio::sync::broadcast;

use crate::auth::JwksCache;
use crate::events::SseEvent;
use crate::jobs::InstallJobs;
use crate::mcp::McpSessions;
use crate::prompt::PendingPrompts;
use crate::skills::SkillsCache;

pub struct AppConfig {
    pub neon_auth_url: String,
    pub user_id: String,
    pub gateway_token: String,
    pub skills_dir: PathBuf,
    pub workspace_skills_dir: PathBuf,
    pub upstream: SocketAddr,
}

impl AppConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let neon_auth_url = std::env::var("NEON_AUTH_URL")
            .map_err(|_| anyhow::anyhow!("missing NEON_AUTH_URL"))?;
        let user_id =
            std::env::var("USER_ID").map_err(|_| anyhow::anyhow!("missing USER_ID"))?;
        let gateway_token = std::env::var("OPENCLAW_GATEWAY_TOKEN")
            .map_err(|_| anyhow::anyhow!("missing OPENCLAW_GATEWAY_TOKEN"))?;
        let skills_dir = std::env::var("SKILLS_DIR")
            .unwrap_or_else(|_| "/app/skills".to_string())
            .into();
        let workspace_skills_dir =
            PathBuf::from("/home/node/.openclaw/workspace/skills");
        let upstream: SocketAddr = "127.0.0.1:18789".parse().unwrap();

        Ok(Self {
            neon_auth_url,
            user_id,
            gateway_token,
            skills_dir,
            workspace_skills_dir,
            upstream,
        })
    }

    pub fn disabled_dir(&self) -> PathBuf {
        self.skills_dir.join(".disabled")
    }
}

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<AppConfig>,
    pub http_client: reqwest::Client,
    pub jwks_cache: Arc<JwksCache>,
    pub event_tx: broadcast::Sender<SseEvent>,
    pub pending_prompts: Arc<PendingPrompts>,
    pub install_jobs: Arc<InstallJobs>,
    pub skills_cache: Arc<SkillsCache>,
    pub mcp_sessions: Arc<McpSessions>,
}
