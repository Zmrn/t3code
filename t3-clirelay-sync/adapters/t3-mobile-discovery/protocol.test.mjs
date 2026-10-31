import * as NodeAssert from "node:assert/strict";
import * as NodeTest from "node:test";

import {
  DEFAULT_T3_SYNC_BASE_URL,
  buildSyncPairingUrl,
  environmentsUrl,
  parseT3SyncEnvironmentList,
  presentSyncReport,
  resolveSyncBaseUrl,
  selectEnvironmentsToPair,
  syncOrigin,
  syncRequestHeaders,
} from "./protocol.mjs";

const ACER = "http://100.80.1.2:3773";
const VPS = "http://100.104.211.62:7433";

NodeTest.test("resolveSyncBaseUrl uses the tailnet hub when empty", () => {
  NodeAssert.equal(resolveSyncBaseUrl(""), DEFAULT_T3_SYNC_BASE_URL);
  NodeAssert.equal(resolveSyncBaseUrl(undefined), DEFAULT_T3_SYNC_BASE_URL);
  NodeAssert.equal(resolveSyncBaseUrl("100.104.211.62:9000/sync"), "http://100.104.211.62:9000");
  NodeAssert.equal(resolveSyncBaseUrl("ftp://100.104.211.62:8318"), null);
});

NodeTest.test("parseT3SyncEnvironmentList reads pairing urls and bootstrap tokens", () => {
  NodeAssert.deepEqual(
    parseT3SyncEnvironmentList({
      environments: [
        {
          machineId: "acer",
          label: "botp-acer",
          httpBaseUrl: `${ACER}/`,
          pairingUrl: `${ACER}/pair#token=acer-token`,
        },
        { name: "vps", host: VPS, bootstrapToken: "vps-token" },
      ],
    }),
    {
      ok: true,
      list: {
        rejected: 0,
        environments: [
          {
            machineId: "acer",
            label: "botp-acer",
            httpBaseUrl: ACER,
            pairingUrl: `${ACER}/pair#token=acer-token`,
          },
          {
            machineId: null,
            label: "vps",
            httpBaseUrl: VPS,
            pairingUrl: buildSyncPairingUrl(VPS, "vps-token"),
          },
        ],
      },
    },
  );
});

NodeTest.test("a url that already carries a token is a pairing link", () => {
  const parsed = parseT3SyncEnvironmentList({
    devices: [{ label: "missing", httpBaseUrl: ACER }, { url: `${VPS}/pair#token=ok` }],
  });
  NodeAssert.equal(parsed.ok, true);
  NodeAssert.equal(parsed.list.rejected, 1);
  NodeAssert.deepEqual(parsed.list.environments, [
    {
      machineId: null,
      label: "100.104.211.62:7433",
      httpBaseUrl: VPS,
      pairingUrl: `${VPS}/pair#token=ok`,
    },
  ]);
});

NodeTest.test("selectEnvironmentsToPair skips saved origins", () => {
  const environments = [
    {
      machineId: "acer",
      label: "botp-acer",
      httpBaseUrl: ACER,
      pairingUrl: `${ACER}/pair#token=a`,
    },
    {
      machineId: "acer-2",
      label: "botp-acer again",
      httpBaseUrl: `${ACER}/pair`,
      pairingUrl: `${ACER}/pair#token=b`,
    },
    {
      machineId: "vps",
      label: "vps",
      httpBaseUrl: VPS,
      pairingUrl: `${VPS}/pair#token=c`,
    },
  ];
  NodeAssert.deepEqual(selectEnvironmentsToPair(environments, new Set([syncOrigin(ACER)])), {
    skipped: 2,
    add: [environments[2]],
  });
});

NodeTest.test("presentSyncReport", () => {
  NodeAssert.deepEqual(presentSyncReport({ added: [], skipped: 2, failures: [], error: null }), {
    phase: "done",
    message: "All 2 machines are already on this phone.",
  });
});

NodeTest.test("sync request headers", () => {
  NodeAssert.equal(
    environmentsUrl(DEFAULT_T3_SYNC_BASE_URL),
    `${DEFAULT_T3_SYNC_BASE_URL}/v1/t3/environments`,
  );
  NodeAssert.deepEqual(syncRequestHeaders(" secret "), {
    accept: "application/json",
    authorization: "Bearer secret",
    "x-t3-sync-token": "secret",
  });
});
