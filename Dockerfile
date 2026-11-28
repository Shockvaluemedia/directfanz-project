# DirectFanz app image for AWS ECS Fargate (ARM64 / Graviton).
#
# Build (the deploy workflow does this):
#   docker buildx build --platform linux/arm64 \
#     --build-arg NEXT_PUBLIC_APP_URL=https://directfanz.io -t directfanz .
#
# NEXT_PUBLIC_* values are baked into the browser bundle at build time, so they
# are build args, not task environment. Nothing secret belongs in a build arg.
# Server-side secrets come from AWS Secrets Manager when the ECS task starts.

# Official Node image via the ECR Public mirror (avoids Docker Hub pull limits).
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:20-bookworm-slim

# --- deps: full install (dev deps needed to build and for the Prisma CLI) ---
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Scripts stay on so ffmpeg-static fetches its binary for this platform.
RUN npm ci --no-audit --no-fund

# --- prod-deps: runtime dependencies only ---
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# --- builder: generate the Prisma client and build Next.js ---
FROM deps AS builder
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_APP_URL=https://directfanz.io
ARG NEXT_PUBLIC_BASE_URL=
ARG NEXT_PUBLIC_APP_NAME=DirectFanz
ARG NEXT_PUBLIC_APP_VERSION=
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG NEXT_PUBLIC_WEBSOCKET_URL=
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL} \
    NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_PUBLIC_WEBSOCKET_URL=${NEXT_PUBLIC_WEBSOCKET_URL} \
    NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
# Build-time placeholders, set inline so none of them persist in the image.
# These mirror the CI build job; real values arrive at runtime.
RUN NODE_ENV=production \
    NEXTAUTH_SECRET=build_time_placeholder_secret_value_32c \
    NEXTAUTH_URL=http://localhost:3000 \
    DATABASE_URL=postgresql://user:pass@localhost:5432/db \
    STRIPE_SECRET_KEY=sk_test_placeholder \
    STRIPE_PUBLISHABLE_KEY=pk_test_placeholder \
    npm run build
# `npm run build` also bundles server.ts (Next.js + socket.io) into
# dist/server.cjs. That build step arrives with PR #54; stop here with a clear
# message if this code predates it.
RUN test -f dist/server.cjs \
  || { echo "dist/server.cjs missing: this build needs PR #54's build:server step" >&2; exit 1; }

# --- runner: the image ECS runs ---
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
# Generated Prisma client, plus the Prisma CLI and engines so the deploy
# workflow can run `prisma migrate deploy` as a one-off task with this image.
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json /app/next.config.js ./
COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/directfanz-entrypoint
RUN chmod 0755 /usr/local/bin/directfanz-entrypoint \
  && ln -s /app/node_modules/.bin/prisma /usr/local/bin/prisma

USER node
EXPOSE 3000

# ECS runs an init process (initProcessEnabled in the task definition), and the
# entrypoint execs Node, so SIGTERM reaches the app during rolling deploys.
ENTRYPOINT ["/usr/local/bin/directfanz-entrypoint"]
# Next.js and the socket.io chat on one port (`npm run start:server`).
CMD ["node", "dist/server.cjs"]
