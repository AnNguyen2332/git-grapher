import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { createServer } from "node:http";

const root = resolve(process.cwd());
const preferredPort = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";
const explicitPort = !!process.env.PORT;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

listen(preferredPort);

function listen(port) {
  const server = createPreviewServer(port);

  server.once("error", function (error) {
    if (error.code === "EADDRINUSE" && !explicitPort && port < preferredPort + 20) {
      process.stdout.write("Port " + port + " is in use; trying " + (port + 1) + ".\n");
      server.close();
      listen(port + 1);
      return;
    }

    if (error.code === "EADDRINUSE") {
      process.stderr.write(
        "Port " + port + " is already in use. Stop the old preview server or run with another port, for example: PORT=5174 npm run preview\n"
      );
      process.exit(1);
      return;
    }

    throw error;
  });

  server.listen(port, host, function () {
    process.stdout.write("Preview server running at http://" + host + ":" + port + "/\n");
  });
}

function createPreviewServer(port) {
  return createServer(async function (request, response) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    const url = new URL(request.url || "/", "http://" + host + ":" + port);
    const pathname = decodeURIComponent(url.pathname);
    const filePath = await resolveRequestPath(pathname);
    const extension = extname(filePath);

    response.writeHead(200, {
      "content-type": contentTypes[extension] || "application/octet-stream",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  });
}

async function resolveRequestPath(pathname) {
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const directPath = resolve(root, "." + safePath);
  const directFile = await existingFile(directPath);
  if (directFile) return directFile;

  const indexPath = join(directPath, "index.html");
  const nestedIndex = await existingFile(indexPath);
  if (nestedIndex) return nestedIndex;

  return resolve(root, "index.html");
}

async function existingFile(filePath) {
  if (!filePath.startsWith(root)) return null;
  try {
    const info = await stat(filePath);
    return info.isFile() ? filePath : null;
  } catch (error) {
    return null;
  }
}
