FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl curl && rm -rf /var/lib/apt/lists/*
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY server.ts ./
COPY server ./server
COPY prisma ./prisma
COPY scripts ./scripts
COPY data ./data

RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3001
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x

COPY package*.json ./
RUN npm ci --omit=dev && npm install prisma@5.7.0 @prisma/client@5.7.0 --no-save && npm cache clean --force

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/data ./data

EXPOSE 3001

ENTRYPOINT ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && exec node dist/server.js"]
