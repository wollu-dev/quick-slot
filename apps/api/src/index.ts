import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { config } from './config.ts';
import { clearLeftovers } from './video.ts';

await clearLeftovers();

const server = serve({ fetch: createApp().fetch, port: config.port }, (info) => {
  console.log(`[api] listening on :${info.port}`);
});

// Finish in-flight requests on shutdown (docker stop sends SIGTERM)
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
