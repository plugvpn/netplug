FROM node:23-alpine AS base
RUN apk add --no-cache wireguard-tools

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install -g npm@11.9.0
RUN npm install
COPY . .
RUN npm build

# Rebuild the source code only when needed
FROM base AS builder

WORKDIR /app
COPY --from=deps /app /app

CMD ["npm", "run", "start"]
