FROM alpine/openclaw:latest

COPY openclaw-template.json /opt/openclaw/openclaw-template.json
COPY entrypoint.sh /opt/openclaw/entrypoint.sh
RUN chmod +x /opt/openclaw/entrypoint.sh

EXPOSE 18789

ENTRYPOINT ["/opt/openclaw/entrypoint.sh"]
