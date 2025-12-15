FROM node:20-slim AS base

WORKDIR /app

# Install dependencies stage
FROM base AS dependencies

COPY package.json ./
COPY package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY libs/models/package.json ./libs/models/

RUN npm ci

# Build stage
FROM base AS build

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY apps ./apps
COPY libs ./libs
COPY nx.json tsconfig.json tsconfig.base.json ./

# Build the web application
RUN npx nx build @sia/web

# Runtime stage
FROM base AS runtime

ENV NODE_ENV=development

# Copy package files for development install
COPY package.json ./
COPY package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY libs/models/package.json ./libs/models/

# Install development dependencies
RUN npm ci --workspace=apps/web --workspace=libs/models --ignore-scripts && \
    rm -rf /tmp/*

# Copy built application
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/next.config.js ./apps/web/next.config.js
COPY --from=build /app/libs/models/dist ./libs/models/dist
COPY --from=build /app/libs/models/package.json ./libs/models/package.json
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["npx", "next", "start"]
