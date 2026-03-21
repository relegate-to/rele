FROM alpine/openclaw:latest

COPY openclaw-template.json /opt/openclaw/openclaw-template.json
COPY --chmod=755 entrypoint.sh /opt/openclaw/entrypoint.sh

WORKDIR /app

EXPOSE 18789

ENTRYPOINT ["/opt/openclaw/entrypoint.sh"]
