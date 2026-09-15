# Build context is the monorepo root (npm workspaces need every workspace's
# package.json present to resolve the lockfile correctly).
FROM node:24-alpine

WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci

COPY apps/web apps/web

# Next.js resolves rewrites() at build time and freezes the destination into
# .next/routes-manifest.json — a runtime env var here would be too late.
ARG BACKEND_URL
ENV BACKEND_URL=${BACKEND_URL}

WORKDIR /repo/apps/web
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000
CMD ["npm", "start"]
