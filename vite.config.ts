import { defineConfig } from "vitest/config";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import routeHandler from "./api/route";

/** Vercel executes api/route.ts in production, but plain `vite` does not.
 * Mount the same handler in development so `npm run dev` exercises the real
 * request contract. Without a server key it deliberately returns the route
 * module's honest straight-line estimate; production remains unchanged. */
function localRouteApi(): Plugin {
  return {
    name: "ithaka-local-route-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/route", async (req, res) => {
        try {
          const body = await readBody(req);
          const request = new Request("http://localhost/api/route", {
            method: req.method,
            headers: requestHeaders(req),
            ...(body.byteLength > 0 ? { body } : {}),
          });
          const response = await routeHandler(request);

          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sendJson(res, 500, { source: "unavailable", error: `Local route middleware failed: ${message}` });
        }
      });
    },
  };
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function requestHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else if (value !== undefined) headers.set(key, value);
  }
  return headers;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localRouteApi()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  test: {
    environment: "node",
  },
});
