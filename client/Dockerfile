# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Production image (Nginx) ──────────────────────────────────────────────────
FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="ptt-radio-client"
LABEL org.opencontainers.image.description="PTT-Radio React client"

# Copy Vite build output
COPY --from=build /app/dist /usr/share/nginx/html

# Custom Nginx config (enables HTTPS headers, gzip, SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
