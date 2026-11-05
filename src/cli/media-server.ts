import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { mediaTypeFromName } from "@/core/media-types";
import { mediaDir } from "@/server/paths";

/**
 * Serves what the composition loads by path, the way the app's server does: project media at
 * /api/media/<project>/<file> and the bundled sound effects at /sfx/<id>.wav. Renders started by the
 * CLI point their media base URL here, so they need no running app. Byte ranges work (video seeks).
 */
/** The file behind a URL path the composition loads (project media or a bundled public file). */
export const resolveMediaPath = (appRoot: string, pathname: string): string | null => {
  const publicDir = path.join(appRoot, "public");
  const media = /^\/api\/media\/([a-z0-9_-]{3,64})\/([^/]+)$/i.exec(pathname);
  if (media) return path.join(mediaDir(media[1]), path.basename(decodeURIComponent(media[2])));
  const file = path.resolve(publicDir, `.${decodeURIComponent(pathname)}`);
  return file.startsWith(publicDir + path.sep) ? file : null;
};

/** Style-pack films are pages: their HTML, modules, styles and fonts need their real types to load. */
const WEB_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  wasm: "application/wasm",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
};

export const contentTypeFor = (file: string) =>
  mediaTypeFromName(file) ?? WEB_TYPES[path.extname(file).slice(1).toLowerCase()] ?? "application/octet-stream";

export const startMediaServer = async (appRoot: string) => {
  const resolve = (pathname: string) => resolveMediaPath(appRoot, pathname);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    // The composition runs on Remotion's own port: allow its WebGL textures and fetches.
    res.setHeader("Access-Control-Allow-Origin", "*");
    const file = resolve(url.pathname);
    if (!file || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    const size = statSync(file).size;
    const type = contentTypeFor(file);
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
      if (start > end || start >= size) {
        res.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
        return;
      }
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
      });
      if (req.method === "HEAD") res.end();
      else createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes" });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
};
