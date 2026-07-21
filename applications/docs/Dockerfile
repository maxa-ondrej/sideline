FROM node:25-slim AS base
RUN npm install -g pnpm@10.28.0
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches/ patches/
COPY --parents packages/*/package.json /app/
COPY applications/docs/package.json applications/docs/
RUN pnpm install --frozen-lockfile --filter @sideline/docs...
COPY applications/docs/ applications/docs/
RUN pnpm --filter @sideline/docs build

FROM nginx:alpine AS production
RUN apk add --no-cache curl
ARG VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=
ENV APP_VERSION=$VERSION GIT_COMMIT=$GIT_COMMIT BUILD_TIME=$BUILD_TIME
COPY --from=build /app/applications/docs/dist /usr/share/nginx/html/docs
COPY applications/docs/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
