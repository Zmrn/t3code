import { UsageLimitSourceId, type ServerSettingsPatch } from "@t3tools/contracts";

export const USAGE_HUB_SEED_ID = UsageLimitSourceId.make("cliproxy-100.104.211.62-8318");
export const USAGE_HUB_SEED_URL = "http://100.104.211.62:8318";
export const USAGE_HUB_SEED_LABEL = "CliRelay VPS (t3-sync hub)";

export interface UsageHubSource {
  readonly url: string;
  readonly managementKey: string;
}

/** Empty when this build was not given a management key. */
export function readUsageHubManagementKey(envValue: string | undefined): string {
  return envValue?.trim() ?? "";
}

/**
 * A patch that adds the CliRelay hub when no saved source for that URL has a key.
 * A non-empty key, including the server's redaction marker, means it is already set.
 */
export function usageHubSeedPatch(
  sources: Readonly<Record<string, UsageHubSource>> | undefined,
  managementKey: string,
): ServerSettingsPatch | null {
  const key = managementKey.trim();
  if (key.length === 0) return null;
  const target = httpOrigin(USAGE_HUB_SEED_URL);
  if (target === null) return null;

  for (const [id, source] of Object.entries(sources ?? {})) {
    if (httpOrigin(source.url) !== target) continue;
    if (source.managementKey.trim().length > 0) return null;
    return { usageLimitSources: { [id]: hubConfig(key) } };
  }

  return { usageLimitSources: { [USAGE_HUB_SEED_ID]: hubConfig(key) } };
}

function hubConfig(managementKey: string) {
  return {
    kind: "cliproxy" as const,
    label: USAGE_HUB_SEED_LABEL,
    url: USAGE_HUB_SEED_URL,
    managementKey,
    enabled: true,
  };
}

function httpOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}
