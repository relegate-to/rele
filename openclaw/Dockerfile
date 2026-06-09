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
FROM alpine/openclaw:latest

USER root

# Install package managers and runtimes for skill installation
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs npm curl git build-essential libcap2-bin gosu jq \
  && rm -rf /var/lib/apt/lists/*
# Install Go from official tarball (apt version is too old for many modules)
RUN curl -fsSL https://go.dev/dl/go1.24.2.linux-amd64.tar.gz | tar -C /usr/local -xz

# Create the unprivileged user the instance runs as. Homebrew is installed
# under the canonical /home/linuxbrew/.linuxbrew prefix (so prebuilt bottles
# work) and then handed over to `rele` — brew refuses to install as root but
# is happy to run under any uid once the prefix is owned by that user.
RUN useradd -m -s /bin/bash rele \
 && useradd -m linuxbrew \
 && su linuxbrew -s /bin/bash -c 'NONINTERACTIVE=1 bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"' \
 && chown -R rele:rele /home/linuxbrew \
 && userdel linuxbrew

ENV PATH="/usr/local/go/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/home/rele/go/bin:${PATH}"
ENV HOME=/home/rele

# Rust sidecar binary — replaces the previous Node-based auth proxy.
# setcap lets the unprivileged sidecar bind port 80.
COPY --from=builder /build/target/release/sidecar /opt/openclaw/sidecar
RUN setcap 'cap_net_bind_service=+ep' /opt/openclaw/sidecar

COPY openclaw-template.json /opt/openclaw/openclaw-template.json
COPY canvas/index.html /opt/openclaw/canvas-placeholder.html
COPY seed/ /opt/openclaw/seed/
COPY --chmod=755 entrypoint.sh /opt/openclaw/entrypoint.sh

RUN mkdir -p /app /opt/openclaw && chown -R rele:rele /app /opt/openclaw

WORKDIR /app

# Entrypoint runs as root so it can chown the Fly volume mounted at
# $OPENCLAW_STATE_DIR (mount ownership is set at mount time, not by the image),
# then drops to the rele user via gosu before launching sidecar + gateway.

EXPOSE 80

ENTRYPOINT ["/opt/openclaw/entrypoint.sh"]
