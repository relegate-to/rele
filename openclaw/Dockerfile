# ── Stage 1: cargo-chef planner ───────────────────────────────────────────────
FROM rust:1-bookworm AS chef
RUN cargo install cargo-chef --locked
WORKDIR /build

FROM chef AS planner
COPY sidecar/ .
RUN cargo chef prepare --recipe-path recipe.json

# ── Stage 2: dependency build (cached) + final build ──────────────────────────
FROM chef AS builder
COPY --from=planner /build/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY sidecar/ .
RUN cargo build --release --bin sidecar

# ── Stage 3: runtime image ────────────────────────────────────────────────────
FROM alpine/openclaw:2026.3.24

USER root

# Install package managers and runtimes for skill installation
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs npm curl git build-essential \
  && rm -rf /var/lib/apt/lists/*
# Install Go from official tarball (apt version is too old for many modules)
RUN curl -fsSL https://go.dev/dl/go1.24.2.linux-amd64.tar.gz | tar -C /usr/local -xz
ENV PATH="/usr/local/go/bin:${PATH}"
# Install Homebrew (Linuxbrew) as a non-root user — brew refuses to run as root
RUN useradd -m linuxbrew
RUN su linuxbrew -s /bin/bash -c 'NONINTERACTIVE=1 bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
ENV PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:${PATH}"
# Ensure go binaries installed via `go install` are on PATH
ENV PATH="/root/go/bin:${PATH}"

# Rust sidecar binary — replaces the previous Node-based auth proxy
COPY --from=builder /build/target/release/sidecar /opt/openclaw/sidecar

COPY openclaw-template.json /opt/openclaw/openclaw-template.json
COPY canvas/index.html /opt/openclaw/canvas-placeholder.html
COPY --chmod=755 entrypoint.sh /opt/openclaw/entrypoint.sh

WORKDIR /app

EXPOSE 80

ENTRYPOINT ["/opt/openclaw/entrypoint.sh"]
