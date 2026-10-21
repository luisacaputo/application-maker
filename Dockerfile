FROM node:22-bookworm-slim AS api-build
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
COPY Nodejs/package.json Nodejs/package-lock.json ./
RUN npm ci
COPY Nodejs/tsconfig.json Nodejs/tsconfig.docker.json ./
COPY Nodejs/src ./src
RUN node node_modules/typescript/bin/tsc -p tsconfig.docker.json \
    && npm prune --omit=dev

FROM node:22-bookworm-slim AS web-build
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=10000
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl nginx supervisor gettext-base \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/generated-projects \
    && chown node:node /app/generated-projects
COPY --from=api-build /app/package.json /app/package-lock.json ./
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/dist ./dist
COPY Nodejs/template ./template
COPY --from=web-build /web/dist /app/public
COPY deploy/ ./deploy/
USER node
EXPOSE 10000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh", "/app/deploy/start.sh"]
