# syntax=docker/dockerfile:1
#
# One image runs all of QuickSlot: the Node server (apps/api) answers /api and serves the built website.
#   docker build -t quickslot .
#   docker run -d -p 8080:8080 -e SITE_URL=https://example.com quickslot
# See docker-compose.yml for a ready-made setup. Published images: .github/workflows/release.yml.
#
# The site is static, but SITE_URL, HIDE_TOOLS and SHOW_TOOLS change what gets built (links, which tools
# have pages). So the image keeps the build tools and rebuilds the site at start when they differ from the
# last build (deploy/entrypoint.sh). With none of them set it starts right away.

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine

# The video downloader runs yt-dlp (ffmpeg merges video and audio; yt-dlp-ejs, from the [default] extra,
# runs site JavaScript with Node). Sites change often, so rebuild the image regularly to pick up a current yt-dlp.
ARG YTDLP_VERSION=2026.10.26
RUN apk add --no-cache ffmpeg python3 py3-pip \
  && pip install --no-cache-dir --break-system-packages "yt-dlp[default]==${YTDLP_VERSION}" \
  && apk del py3-pip \
  && mkdir /work /app && chown node:node /work /app

# Everything below runs as the unprivileged node user, which also owns the files the start-up build writes
USER node
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps/web/package.json apps/web/
COPY --chown=node:node apps/api/package.json apps/api/
RUN npm ci && npm cache clean --force
COPY --chown=node:node apps/web apps/web
COPY --chown=node:node apps/api/src apps/api/src
RUN npm run build -w apps/web \
  && printf 'SITE_URL=\nHIDE_TOOLS=\nSHOW_TOOLS=' > /app/.build-config
COPY --chown=node:node deploy/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Set by the release workflow; /api/health reports it
ARG APP_VERSION
ENV NODE_ENV=production APP_VERSION=${APP_VERSION} PORT=8080 SITE_DIR=/app/apps/web/dist \
  VIDEO_WORK_DIR=/work XDG_CACHE_HOME=/tmp
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=180s CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1
CMD ["/app/entrypoint.sh"]
