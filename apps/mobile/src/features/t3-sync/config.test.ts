import { describe, expect, it } from "vite-plus/test";

import { resolveT3SyncConfig } from "./configResolve";
import { DEFAULT_T3_SYNC_BASE_URL } from "./protocol";

describe("resolveT3SyncConfig", () => {
  it("prefers a saved hub over the build-time variables", () => {
    expect(
      resolveT3SyncConfig({
        stored: { baseUrl: "http://100.1.1.1:8318", token: "saved" },
        envBaseUrl: "http://100.2.2.2:8318",
        envToken: "from-env",
      }),
    ).toEqual({ baseUrl: "http://100.1.1.1:8318", token: "saved" });
  });

  it("uses the build-time hub when nothing is saved, including an empty token", () => {
    expect(
      resolveT3SyncConfig({
        stored: null,
        envBaseUrl: undefined,
        envToken: "  ",
      }),
    ).toEqual({ baseUrl: DEFAULT_T3_SYNC_BASE_URL, token: "" });
  });

  it("treats a saved empty token as no token", () => {
    expect(
      resolveT3SyncConfig({
        stored: { baseUrl: DEFAULT_T3_SYNC_BASE_URL, token: "" },
        envBaseUrl: undefined,
        envToken: "from-env",
      }),
    ).toEqual({ baseUrl: DEFAULT_T3_SYNC_BASE_URL, token: "" });
  });
});
