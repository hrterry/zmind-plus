# syntax=docker/dockerfile:1.7

FROM node:24.22.1-bookworm-slim AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/runtime/package.json apps/runtime/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/adapter-claude-code/package.json packages/adapter-claude-code/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/store/package.json packages/store/package.json
RUN npm ci

FROM dependencies AS build
COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm run build
RUN npm prune --omit=dev

FROM node:24.22.1-bookworm-slim AS runtime
ENV NODE_ENV=production \
    ZMIND_HOST=0.0.0.0 \
    ZMIND_PORT=4311 \
    ZMIND_DATABASE_PATH=/data/events.db \
    ZMIND_UI_ORIGINS=http://127.0.0.1:4310,http://localhost:4310
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/runtime/dist ./apps/runtime/dist
RUN mkdir -p /data && chown node:node /data

USER node
EXPOSE 4311
VOLUME ["/data"]
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4311/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/runtime/dist/main.js"]

FROM nginx:1.30.6-alpine3.24-slim AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=5 \
  CMD wget -q -O - http://127.0.0.1/health >/dev/null || exit 1
