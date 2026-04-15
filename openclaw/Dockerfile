FROM node:22-alpine AS deps
WORKDIR /opt/openclaw
RUN npm init -y && npm install jose

FROM alpine/openclaw:2026.3.24

USER root

# Install package managers and runtimes for skill installation
RUN apt-get update && apt-get install -y --no-install-recommends \
    golang nodejs npm curl git build-essential \
  && rm -rf /var/lib/apt/lists/*
# Install Homebrew (Linuxbrew) as a non-root user — brew refuses to run as root
RUN useradd -m linuxbrew
RUN su linuxbrew -s /bin/bash -c 'NONINTERACTIVE=1 bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
ENV PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:${PATH}"
# Ensure go binaries installed via `go install` are on PATH
ENV PATH="/root/go/bin:${PATH}"

# jose for JWT validation in auth proxy
COPY --from=deps /opt/openclaw/node_modules /opt/openclaw/node_modules
COPY --from=deps /opt/openclaw/package.json /opt/openclaw/package.json

COPY sidecar/ /opt/openclaw/sidecar/
COPY openclaw-template.json /opt/openclaw/openclaw-template.json
COPY canvas/index.html /opt/openclaw/canvas-placeholder.html
COPY --chmod=755 entrypoint.sh /opt/openclaw/entrypoint.sh

WORKDIR /app

EXPOSE 80

ENTRYPOINT ["/opt/openclaw/entrypoint.sh"]
