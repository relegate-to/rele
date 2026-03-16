FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock* ./
COPY db/package.json ./db/
COPY gate/package.json ./gate/
COPY web/package.json ./web/
RUN bun install --frozen-lockfile --production

FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY --from=install /app/gate/node_modules ./gate/node_modules
COPY --from=install /app/gate/node_modules ./db/node_modules
COPY gate/ ./gate/
COPY db/src ./db/src
COPY db/package.json ./db/

ENV PORT=3001
EXPOSE 3001

CMD ["bun", "run", "gate/src/index.ts"]
