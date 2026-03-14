FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock* ./
COPY gate/package.json ./gate/
COPY db/package.json ./db/
RUN bun install --frozen-lockfile --production

FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY --from=install /app/gate/node_modules ./gate/node_modules
COPY gate/src ./gate/src
COPY gate/package.json ./gate/
COPY db/src ./db/src

ENV PORT=3001
EXPOSE 3001

CMD ["bun", "run", "gate/src/index.ts"]
