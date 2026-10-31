import { describe, expect, it } from "vite-plus/test";

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
} from "./protocol";

const ACER = "http://100.80.1.2:3773";
const VPS = "http://100.104.211.62:7433";

describe("resolveSyncBaseUrl", () => {
  it("uses the tailnet hub when the field is empty", () => {
    expect(resolveSyncBaseUrl("")).toBe(DEFAULT_T3_SYNC_BASE_URL);
    expect(resolveSyncBaseUrl(null)).toBe(DEFAULT_T3_SYNC_BASE_URL);
  });

  it("accepts a schemeless tailscale address and drops a path", () => {
    expect(resolveSyncBaseUrl("100.104.211.62:9000/sync")).toBe("http://100.104.211.62:9000");
  });

  it("rejects a non-http scheme", () => {
    expect(resolveSyncBaseUrl("ftp://100.104.211.62:8318")).toBeNull();
  });
});

describe("parseT3SyncEnvironmentList", () => {
  it("reads pairing urls and bootstrap tokens", () => {
    const parsed = parseT3SyncEnvironmentList({
      environments: [
        {
          machineId: "acer",
          label: "botp-acer",
          httpBaseUrl: `${ACER}/`,
          pairingUrl: `${ACER}/pair#token=acer-token`,
        },
        {
          name: "vps",
          host: VPS,
          bootstrapToken: "vps-token",
        },
      ],
    });

    expect(parsed).toEqual({
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
    });
  });

  it("accepts devices and machines aliases and counts entries with no token", () => {
    const parsed = parseT3SyncEnvironmentList({
      devices: [{ label: "missing", httpBaseUrl: ACER }, { url: `${VPS}/pair#token=ok` }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.list.rejected).toBe(1);
    expect(parsed.list.environments).toEqual([
      {
        machineId: null,
        label: "100.104.211.62:7433",
        httpBaseUrl: VPS,
        pairingUrl: `${VPS}/pair#token=ok`,
      },
    ]);
  });

  it("rejects a body that is not a list", () => {
    expect(parseT3SyncEnvironmentList({ providers: [] })).toEqual({
      ok: false,
      error: "Sync hub response has no environments list.",
    });
  });
});

describe("selectEnvironmentsToPair", () => {
  it("skips origins already saved on the phone and duplicate hub rows", () => {
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

    expect(selectEnvironmentsToPair(environments, new Set([syncOrigin(ACER)!]))).toEqual({
      skipped: 2,
      add: [environments[2]],
    });
  });
});

describe("presentSyncReport", () => {
  it("says when every machine is already paired", () => {
    expect(presentSyncReport({ added: [], skipped: 2, failures: [], error: null })).toEqual({
      phase: "done",
      message: "All 2 machines are already on this phone.",
    });
  });

  it("keeps pairing failures visible after a partial add", () => {
    expect(
      presentSyncReport({
        added: ["vps"],
        skipped: 1,
        failures: [{ label: "botp-acer", error: "Pairing URL is missing its token." }],
        error: null,
      }),
    ).toEqual({
      phase: "error",
      message:
        "Added vps. Skipped 1 already on this phone. botp-acer: Pairing URL is missing its token.",
    });
  });
});

describe("sync request", () => {
  it("builds the list url and sends the hub token on both headers", () => {
    expect(environmentsUrl(DEFAULT_T3_SYNC_BASE_URL)).toBe(
      `${DEFAULT_T3_SYNC_BASE_URL}/v1/t3/environments`,
    );
    expect(syncRequestHeaders(" secret ")).toEqual({
      accept: "application/json",
      authorization: "Bearer secret",
      "x-t3-sync-token": "secret",
    });
    expect(syncRequestHeaders("")).toEqual({ accept: "application/json" });
  });
});
