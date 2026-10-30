import * as NodeHttp from "node:http";

import { handleNodeRequest } from "./handler.mjs";
import { resolveSyncBaseUrl } from "./protocol.mjs";
import { createFileStore } from "./store.mjs";

const filePath = process.env.T3_MOBILE_DISCOVERY_FILE ?? "data/t3-mobile-environments.json";
const token = process.env.T3_SYNC_TOKEN ?? "";
const base = resolveSyncBaseUrl(process.env.T3_MOBILE_DISCOVERY_BASE ?? "http://127.0.0.1:8318");
const port = Number(new URL(base).port || 8318);
const host = new URL(base).hostname;

const store = await createFileStore(filePath);
const server = NodeHttp.createServer((req, res) => {
  handleNodeRequest(req, res, { store, token }).then((handled) => {
    if (handled) return;
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Not found." }));
  });
});

server.listen(port, host, () => {
  process.stdout.write(
    `t3 mobile discovery listening on http://${host}:${port}/v1/t3/environments\n`,
  );
});
