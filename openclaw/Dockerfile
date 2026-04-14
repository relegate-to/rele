FROM oven/bun:alpine AS deps
WORKDIR /opt/openclaw
RUN bun add jose hono

FROM alpine/openclaw:2026.3.24

USER root

# Bun runtime for the sidecar
COPY --from=oven/bun:alpine /usr/local/bin/bun /usr/local/bin/bun

# sidecar dependencies
COPY --from=deps /opt/openclaw/node_modules /opt/openclaw/node_modules
COPY --from=deps /opt/openclaw/package.json /opt/openclaw/package.json

COPY sidecar/ /opt/openclaw/sidecar/
COPY openclaw-template.json /opt/openclaw/openclaw-template.json
COPY canvas/index.html /opt/openclaw/canvas-placeholder.html
COPY --chmod=755 entrypoint.sh /opt/openclaw/entrypoint.sh

WORKDIR /app

EXPOSE 80

ENTRYPOINT ["/opt/openclaw/entrypoint.sh"]
