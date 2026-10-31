import { describe, expect, it } from "vite-plus/test";

import { syncDiscoveredEnvironments } from "./discover";

describe("syncDiscoveredEnvironments", () => {
  it("pairs only machines the phone does not already have", async () => {
    const paired: string[] = [];
    const report = await syncDiscoveredEnvironments({
      savedOrigins: new Set(["http://100.80.1.2:3773"]),
      environments: [
        {
          machineId: "acer",
          label: "botp-acer",
          httpBaseUrl: "http://100.80.1.2:3773",
          pairingUrl: "http://100.80.1.2:3773/pair#token=old",
        },
        {
          machineId: "vps",
          label: "vps",
          httpBaseUrl: "http://100.104.211.62:7433",
          pairingUrl: "http://100.104.211.62:7433/pair#token=fresh",
        },
      ],
      pair: async (pairingUrl) => {
        paired.push(pairingUrl);
        return { ok: true, error: null };
      },
    });

    expect(paired).toEqual(["http://100.104.211.62:7433/pair#token=fresh"]);
    expect(report).toEqual({
      added: ["vps"],
      skipped: 1,
      failures: [],
      error: null,
    });
  });

  it("continues after one machine refuses the pairing token", async () => {
    const report = await syncDiscoveredEnvironments({
      savedOrigins: new Set(),
      environments: [
        {
          machineId: "a",
          label: "first",
          httpBaseUrl: "http://100.0.0.1:3773",
          pairingUrl: "http://100.0.0.1:3773/pair#token=a",
        },
        {
          machineId: "b",
          label: "second",
          httpBaseUrl: "http://100.0.0.2:3773",
          pairingUrl: "http://100.0.0.2:3773/pair#token=b",
        },
      ],
      pair: async (pairingUrl) =>
        pairingUrl.includes("100.0.0.1")
          ? { ok: false, error: "Pairing URL is missing its token." }
          : { ok: true, error: null },
    });

    expect(report.added).toEqual(["second"]);
    expect(report.failures).toEqual([
      { label: "first", error: "Pairing URL is missing its token." },
    ]);
  });
});
