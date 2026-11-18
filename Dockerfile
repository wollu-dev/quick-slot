# syntax=docker/dockerfile:1
#
# Two images from one file:
#   docker build --target web -t quickslot-web .
#   docker build --target api -t quickslot-api .
# See docker-compose.yml for running them together. Published images: .github/workflows/release.yml.

ARG NODE_VERSION=24

# ── web: nginx serving the static site, /api proxied to the api service ─
# The site is static, but SITE_URL, HIDE_TOOLS and SHOW_TOOLS change what gets built (links, which tools
# have pages). So the image keeps the build tools and rebuilds at start when they differ from the
# default build (deploy/web-entrypoint.sh). With none of them set it starts right away.
FROM node:${NODE_VERSION}-alpine AS web
RUN apk add --no-cache nginx \
  && ln -sf /dev/stdout /var/log/nginx/access.log \
  && ln -sf /dev/stderr /var/log/nginx/error.log \
  && mkdir -p /run/nginx
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace apps/web --include-workspace-root && npm cache clean --force
COPY apps/web apps/web
ENV ASTRO_TELEMETRY_DISABLED=1
RUN npm run build -w apps/web \
  && printf 'SITE_URL=\nHIDE_TOOLS=\nSHOW_TOOLS=' > /app/.build-config
COPY deploy/nginx.conf /etc/nginx/http.d/default.conf
COPY deploy/web-entrypoint.sh /usr/local/bin/quickslot-web
RUN chmod +x /usr/local/bin/quickslot-web
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=180s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["quickslot-web"]

# ── api: Node runs the TypeScript sources directly (type stripping) ───
FROM node:${NODE_VERSION}-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
# Set by the release workflow; /api/health reports it
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}
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
