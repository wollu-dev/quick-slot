# syntax=docker/dockerfile:1
#
# Two images from one file:
#   docker build --target web --build-arg SITE_URL=https://example.com -t quickslot-web .
#   docker build --target api -t quickslot-api .
# See docker-compose.yml for running them together.

ARG NODE_VERSION=24

# ── Build the static site ─────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS web-build
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace apps/web --include-workspace-root
COPY apps/web apps/web
# The site URL is baked into hreflang and canonical links at build time
ARG SITE_URL
ENV SITE_URL=${SITE_URL}
RUN npm run build -w apps/web

# ── web: nginx serving the static output, /api proxied to the api service ─
FROM nginx:1.29-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /src/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

# ── api: Node runs the TypeScript sources directly (type stripping) ───
FROM node:${NODE_VERSION}-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
# The video downloader runs yt-dlp (ffmpeg merges video and audio; yt-dlp-ejs, from the [default] extra,
# runs site JavaScript with Node). Sites change often,
# so rebuild the image regularly to pick up a current yt-dlp.
ARG YTDLP_VERSION=2026.10.26
RUN apk add --no-cache ffmpeg python3 py3-pip \
  && pip install --no-cache-dir --break-system-packages "yt-dlp[default]==${YTDLP_VERSION}" \
  && apk del py3-pip \
  && mkdir /work && chown node:node /work
ENV VIDEO_WORK_DIR=/work XDG_CACHE_HOME=/tmp
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/api --omit=dev && npm cache clean --force
COPY apps/api/src apps/api/src
USER node
ENV PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/api/health >/dev/null || exit 1
CMD ["node", "apps/api/src/index.ts"]
