FROM mcr.microsoft.com/playwright:v1.62.1-noble

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/focuspath/package.json packages/focuspath/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY packages/focuspath packages/focuspath
COPY apps/api apps/api
RUN npm run build --workspace focuspath \
  && npm run build --workspace @focuspath/api \
  && npm prune --omit=dev

ENV NODE_ENV=production \
  PORT=8080

USER pwuser
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/api/dist/server.js"]
