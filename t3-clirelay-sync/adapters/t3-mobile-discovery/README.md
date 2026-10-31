# T3 mobile discovery

The phone learns registered T3 machines from this hub and pairs them with the normal T3 pairing token. The hub does not proxy sessions and does not sync provider credentials. Provider sync stays on its own routes.

`GET /v1/t3/environments` is what Android calls. `POST` and `PUT` upsert one machine. `DELETE /v1/t3/environments/:machineId` removes it.

See [docs/t3-mobile-discovery.md](../../docs/t3-mobile-discovery.md).

## Mount

Call `handleNodeRequest` from the process that already listens on `:8318`, before other routes. A `null`/false result means the path is not this adapter.

```js
import { handleNodeRequest } from "./adapters/t3-mobile-discovery/handler.mjs";
import { createFileStore } from "./adapters/t3-mobile-discovery/store.mjs";

const discovery = {
  store: await createFileStore(
    process.env.T3_MOBILE_DISCOVERY_FILE ?? "data/t3-mobile-environments.json",
  ),
  token: process.env.T3_SYNC_TOKEN ?? "",
};

// inside the existing request listener:
if (await handleNodeRequest(req, res, discovery)) return;
```

`T3_SYNC_TOKEN` empty means the tailnet is the only boundary. When it is set, the client must send `Authorization: Bearer` or `X-T3-Sync-Token`.

## Standalone

Only when nothing else owns the port:

```sh
T3_MOBILE_DISCOVERY_BASE=http://0.0.0.0:8318 node adapters/t3-mobile-discovery/server.mjs
```

## Publish a desktop

```sh
node adapters/t3-mobile-discovery/publish.mjs \
  --hub http://100.104.211.62:8318 \
  --machine-id botp-acer \
  --label botp-acer \
  --http-base http://100.80.1.2:3773 \
  --pairing-token DESKTOP_BOOTSTRAP_OR_PAIRING_TOKEN
```

## Check

```sh
node --test adapters/t3-mobile-discovery/*.test.mjs
```

The Android parser is `apps/mobile/src/features/t3-sync/protocol.ts` in the T3 Code fork. It must stay behavior-identical with `protocol.mjs`.
