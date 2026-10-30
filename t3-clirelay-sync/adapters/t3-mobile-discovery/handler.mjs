import * as NodeCrypto from "node:crypto";

import { parseT3SyncEnvironmentList } from "./protocol.mjs";

const LIST_PATH = "/v1/t3/environments";
const MACHINE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export async function handleDiscoveryRequest(request, options) {
  const url = new URL(request.url);
  if (url.pathname !== LIST_PATH && !url.pathname.startsWith(`${LIST_PATH}/`)) return null;
  if (!authorized(request, options.token ?? "")) {
    return json(401, { error: "Sync hub refused the token." });
  }

  if (request.method === "GET" && url.pathname === LIST_PATH) {
    return json(200, { environments: await options.store.list() });
  }

  if ((request.method === "POST" || request.method === "PUT") && url.pathname === LIST_PATH) {
    return register(request, options.store);
  }

  if (request.method === "DELETE" && url.pathname.startsWith(`${LIST_PATH}/`)) {
    const machineId = decodeURIComponent(url.pathname.slice(LIST_PATH.length + 1));
    if (!MACHINE_ID.test(machineId)) return json(400, { error: "machineId is invalid." });
    const removed = await options.store.remove(machineId);
    return json(
      removed ? 200 : 404,
      removed ? { ok: true } : { error: "Machine was not registered." },
    );
  }

  return json(405, { error: "Method is not allowed." });
}

export async function handleNodeRequest(req, res, options) {
  const host = req.headers.host ?? "127.0.0.1";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
  const response = await handleDiscoveryRequest(request, options);
  if (response === null) return false;
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
  return true;
}

async function register(request, store) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Body must be JSON." });
  }
  const parsed = parseT3SyncEnvironmentList({ environments: [body] });
  if (!parsed.ok || parsed.list.environments.length !== 1) {
    return json(400, { error: "Need httpBaseUrl and a pairingUrl or bootstrapToken." });
  }
  const environment = parsed.list.environments[0];
  if (environment.machineId === null || !MACHINE_ID.test(environment.machineId)) {
    return json(400, { error: "machineId is required to register a machine." });
  }
  await store.upsert(environment);
  return json(200, { environment });
}

function authorized(request, expected) {
  const token = expected.trim();
  if (token.length === 0) return true;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const alternate = request.headers.get("x-t3-sync-token")?.trim() ?? "";
  return safeEqual(bearer, token) || safeEqual(alternate, token);
}

function safeEqual(presented, expected) {
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  if (left.length !== right.length || left.length === 0) return false;
  return NodeCrypto.timingSafeEqual(left, right);
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
