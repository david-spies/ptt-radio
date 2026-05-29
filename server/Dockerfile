# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

WORKDIR /app

# Install deps
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

# Copy source
COPY src ./src

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine

LABEL org.opencontainers.image.title="ptt-radio-signal"
LABEL org.opencontainers.image.description="PTT-Radio WebSocket signaling server"

# Run as non-root
RUN addgroup -S ptt && adduser -S ptt -G ptt
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/src          ./src
COPY package.json ./

USER ptt

EXPOSE 3001

CMD ["node", "src/index.js"]
