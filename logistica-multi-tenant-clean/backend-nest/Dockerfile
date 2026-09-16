FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY backend-nest/package*.json ./backend-nest/
COPY frontend/package*.json ./frontend/
RUN npm ci
COPY backend-nest ./backend-nest
RUN npx prisma generate --schema backend-nest/prisma/schema.prisma
RUN npm run build --workspace=backend-nest

FROM node:20-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend-nest
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/backend-nest/dist ./dist
COPY --from=builder /app/backend-nest/tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["node", "-r", "tsconfig-paths/register", "dist/src/main.js"]