FROM node:22-alpine AS deps
WORKDIR /opt/openclaw
RUN npm init -y && npm install jose ws

FROM alpine/openclaw:2026.3.31

USER root

# jose for JWT validation in auth proxy
COPY --from=deps /opt/openclaw/node_modules /opt/openclaw/node_modules
COPY --from=deps /opt/openclaw/package.json /opt/openclaw/package.json

COPY auth-server.mjs /opt/openclaw/auth-server.mjs
COPY pair.mjs /opt/openclaw/pair.mjs
COPY openclaw-template.json /opt/openclaw/openclaw-template.json
COPY --chmod=755 entrypoint.sh /opt/openclaw/entrypoint.sh

WORKDIR /app

EXPOSE 80

ENTRYPOINT ["/opt/openclaw/entrypoint.sh"]
