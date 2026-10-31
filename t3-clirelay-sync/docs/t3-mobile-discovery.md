# Mobile discovery of self-hosted T3 environments

Android should open sessions on every machine registered with this hub without a pairing code typed in by hand. Official T3 Connect is not part of this path. Provider sync (API credentials and CLI providers) is a different protocol and must not be reused as the machine list.

Default hub: `http://100.104.211.62:8318`

Headless T3 on the VPS (`http://100.104.211.62:7433`) is one environment the hub can advertise. CliRelay on `:8317` is not a T3 environment.

## Roles

1. A desktop, or `publish.mjs`, registers that machine's T3 HTTP base and a pairing credential.
2. The hub stores one row per `machineId`.
3. The phone `GET`s the list on launch and from the **Sync** button, then pairs each origin it does not already have.
4. Session traffic after that is the normal T3 WebSocket to that machine. The hub is not in the path.

The phone copy of this contract is `apps/mobile/src/features/t3-sync/protocol.ts` in the T3 Code fork. `adapters/t3-mobile-discovery/protocol.mjs` is the copy in this repo. Change both together.

## HTTP

Optional auth, required when `T3_SYNC_TOKEN` is set on the hub:

- `Authorization: Bearer <token>`
- `X-T3-Sync-Token: <token>`

### List

`GET /v1/t3/environments`

```json
{
  "environments": [
    {
      "machineId": "botp-acer",
      "label": "botp-acer",
      "httpBaseUrl": "http://100.80.1.2:3773",
      "pairingUrl": "http://100.80.1.2:3773/pair#token=PAIRING_OR_DESKTOP_BOOTSTRAP"
    }
  ]
}
```

The phone also accepts a top-level array, or `devices` / `machines` instead of `environments`. `bootstrapToken` (aliases `pairingToken`, `token`) plus `httpBaseUrl` is enough. A `url` that already contains `#token=` is treated as the pairing link.

Rows with no token are ignored (`rejected` on the client). The phone pairs through T3's existing `/oauth/token` bootstrap exchange. It skips an HTTP origin it has already saved, so a later sync does not spend a one-time code again.

Use a desktop bootstrap token when every phone should be able to pair, including after someone removes the environment. A one-time pairing code works for the first phone that syncs. Republish with `PUT` when the credential changes.

### Register

`POST` or `PUT /v1/t3/environments`

```json
{
  "machineId": "botp-acer",
  "label": "botp-acer",
  "httpBaseUrl": "http://100.80.1.2:3773",
  "bootstrapToken": "desktop-bootstrap"
}
```

`machineId` matches `[A-Za-z0-9._:-]{1,128}` and upserts. `pairingUrl` may replace `bootstrapToken`.

### Remove

`DELETE /v1/t3/environments/botp-acer`

Removing a row does not unpair phones that already saved the environment.

## Storage

`T3_MOBILE_DISCOVERY_FILE` (default `data/t3-mobile-environments.json`) holds `{ "environments": [ ... ] }`. Mount `handleNodeRequest` inside the existing sync server. Run `server.mjs` only when that port is free.

The pairing URL is a credential. Keep the hub on the tailnet, or set `T3_SYNC_TOKEN`.

## Android

Build steps for the fork are in `apps/mobile/T3_SYNC.md` of the T3 Code repo. The app's default hub is this base URL. Environments → VPS sync can change it on the phone.
