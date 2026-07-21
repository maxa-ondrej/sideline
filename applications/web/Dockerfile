FROM node:25-slim AS base
RUN npm install -g pnpm@10.28.0
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches/ patches/
COPY --parents packages/*/package.json /app/
COPY applications/web/package.json applications/web/
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=
ENV APP_VERSION=$VERSION GIT_COMMIT=$GIT_COMMIT BUILD_TIME=$BUILD_TIME
COPY packages/ /app/packages/
COPY applications/web/ applications/web/
COPY tsconfig.* /app/
RUN pnpm --recursive --parallel run codegen && pnpm build

FROM base AS production
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
ARG VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=
ENV APP_VERSION=$VERSION GIT_COMMIT=$GIT_COMMIT BUILD_TIME=$BUILD_TIME
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches/ patches/
COPY --from=build --parents /app/packages/*/package.json /app/packages/*/dist /
COPY applications/web/package.json applications/web/
RUN pnpm install --frozen-lockfile --prod --ignore-scripts
COPY --from=build /app/applications/web/.output applications/web/.output

EXPOSE 3000

CMD ["node", "applications/web/.output/server/index.mjs"]
