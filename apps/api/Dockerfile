FROM node:20-slim AS base

WORKDIR /app

FROM base AS dependencies

COPY package.json ./
COPY package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY libs/models/package.json ./libs/models/

RUN npm ci

FROM base AS build

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY apps ./apps
COPY libs ./libs
COPY nx.json tsconfig.json tsconfig.base.json ./

RUN npx nx build @sia/api

FROM base AS runtime

ENV NODE_ENV=production

COPY package.json ./
COPY package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY libs/models/package.json ./libs/models/

RUN npm ci --production --workspace=apps/api --workspace=libs/models && \
    rm -rf /tmp/*

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/api/drizzle.config.ts ./apps/api/drizzle.config.ts
COPY --from=build /app/apps/api/scripts ./apps/api/scripts
COPY --from=build /app/libs/models/dist ./libs/models/dist
COPY --from=build /app/libs/models/package.json ./libs/models/package.json
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json

WORKDIR /app/apps/api

CMD ["sh", "-c", "npx tsx scripts/migrate.ts && npx tsx scripts/seed.ts && npx tsx dist/main.js"]

