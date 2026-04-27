# syntax=docker/dockerfile:1

FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma/

RUN --mount=type=cache,id=pnpm-store-netplug,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --prefer-offline

FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm exec prisma generate

ENV DATABASE_URL="file:./build-dummy.db"

RUN pnpm run build

# Minimal Prisma CLI + engines for `migrate deploy` (avoids a global npm install and huge copies from the dev tree)
FROM base AS prisma-migrate
WORKDIR /opt/prisma-migrate
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY .npmrc ./
RUN echo '{"name":"prisma-migrate","private":true,"pnpm":{"onlyBuiltDependencies":["@prisma/engines","prisma"]}}' > package.json

RUN --mount=type=cache,id=pnpm-store-prisma-migrate,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm add prisma@6.19.3 --prod --prefer-offline

FROM base AS runner
WORKDIR /app

RUN apk add --no-cache wireguard-tools iptables sqlite iproute2 openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PATH="/opt/prisma-migrate/node_modules/.bin:${PATH}"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=prisma-migrate /opt/prisma-migrate/node_modules /opt/prisma-migrate/node_modules

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
