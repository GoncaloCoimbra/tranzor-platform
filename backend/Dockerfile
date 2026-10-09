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
RUN npm ci --omit=dev \
    && npm install --no-save --package-lock=false prisma@5.7.0 @prisma/client@5.7.0

COPY prisma ./prisma
RUN npx prisma generate \
    && npm cache clean --force \
    && mkdir -p /app/logs

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/data ./data
RUN chown -R node:node /app

EXPOSE 3001

USER node
ENTRYPOINT ["sh", "-c", "npx prisma migrate deploy && exec node dist/server.js"]
