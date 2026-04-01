# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
 
WORKDIR /app
 
COPY package*.json ./
RUN npm ci
 
COPY . .
RUN npm run build
 
# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS production
 
RUN apk add --no-cache postgresql-client
 
WORKDIR /app
 
COPY package*.json ./
RUN npm ci --only=production
 
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db
COPY migrate.sh ./migrate.sh
RUN chmod +x ./migrate.sh
 
ENV NODE_PATH=/app
 
EXPOSE 3000
 
CMD ["sh", "-c", "cd /app && sh migrate.sh && node dist/src/main"] 