# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN ls -la dist/

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /

RUN apk add --no-cache postgresql-client

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /ist ./dist
COPY --from=builder /db ./db
COPY migrate.sh ./migrate.sh
RUN chmod +x migrate.sh
RUN ls -la dist/

EXPOSE 3000

CMD sh migrate.sh && node dist/main