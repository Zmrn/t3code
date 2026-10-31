import { describe, expect, it } from "vite-plus/test";

import {
  USAGE_HUB_SEED_ID,
  USAGE_HUB_SEED_LABEL,
  USAGE_HUB_SEED_URL,
  readUsageHubManagementKey,
  usageHubSeedPatch,
} from "./seedUsageHub";

const KEY = "build-time-key";

describe("readUsageHubManagementKey", () => {
  it("treats a missing build variable as no seed", () => {
    expect(readUsageHubManagementKey(undefined)).toBe("");
    expect(readUsageHubManagementKey("  ")).toBe("");
  });
});

describe("usageHubSeedPatch", () => {
  it("adds the CliRelay hub when settings have no source for that URL", () => {
    expect(usageHubSeedPatch({}, KEY)).toEqual({
      usageLimitSources: {
        [USAGE_HUB_SEED_ID]: {
          kind: "cliproxy",
          label: USAGE_HUB_SEED_LABEL,
          url: USAGE_HUB_SEED_URL,
          managementKey: KEY,
          enabled: true,
        },
      },
    });
  });

  it("fills an existing hub row that has no key and does not replace a configured one", () => {
    expect(
      usageHubSeedPatch({ other: { url: "http://100.104.211.62:8318/", managementKey: "" } }, KEY),
    ).toEqual({
      usageLimitSources: {
        other: {
          kind: "cliproxy",
          label: USAGE_HUB_SEED_LABEL,
          url: USAGE_HUB_SEED_URL,
          managementKey: KEY,
          enabled: true,
        },
      },
    });
    expect(
      usageHubSeedPatch({ other: { url: USAGE_HUB_SEED_URL, managementKey: "••••••" } }, KEY),
    ).toBeNull();
  });

  it("does nothing without a build-time key", () => {
    expect(usageHubSeedPatch(undefined, "")).toBeNull();
  });
});
