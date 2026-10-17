# Self-hosted production image for the Supastack web app.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY patches ./patches
COPY packages ./packages
COPY apps/web ./apps/web
RUN mkdir -p apps/web/public
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY eslint.config.mjs prettier.config.mjs ./
RUN APP_ENV=local pnpm --filter @supastack/web build
RUN mkdir -p /app/apps/web/public

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV APP_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
# Run as the image's unprivileged `node` user — the standalone server only
# writes to apps/web/.next/cache (image/ISR cache); everything else is reads.
RUN mkdir -p apps/web/.next/cache && chown -R node:node apps/web
USER node
EXPOSE 8080
CMD ["sh", "-c", "APP_ENV=production exec node apps/web/server.js"]
