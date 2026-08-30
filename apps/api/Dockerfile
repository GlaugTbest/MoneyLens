# Build context is the monorepo root (npm workspaces need every workspace's
# package.json present to resolve the lockfile correctly).
FROM node:20-alpine

# Prisma's query engine needs a matching libssl on Alpine, or it silently
# defaults to the wrong version and can fail at runtime.
RUN apk add --no-cache openssl

WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY apps/api apps/api

WORKDIR /repo/apps/api
RUN npx prisma generate
RUN npm run build

EXPOSE 3001

# Applies pending migrations and re-syncs the (idempotent) category/rule seed
# on every boot, then starts the compiled server.
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node prisma/seed.ts && node dist/src/main.js"]
