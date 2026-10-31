import * as SecureStore from "expo-secure-store";

import { resolveT3SyncConfig, type T3SyncConfig } from "./configResolve";

const CONFIG_KEY = "t3code.t3sync.config";

export type { T3SyncConfig } from "./configResolve";

export async function loadT3SyncConfig(): Promise<T3SyncConfig> {
  const envBaseUrl = process.env.EXPO_PUBLIC_T3_SYNC_BASE_URL;
  const envToken = process.env.EXPO_PUBLIC_T3_SYNC_TOKEN;
  try {
    const raw = await SecureStore.getItemAsync(CONFIG_KEY);
    return resolveT3SyncConfig({
      stored: parseStoredConfig(raw),
      envBaseUrl,
      envToken,
    });
  } catch {
    return resolveT3SyncConfig({ stored: null, envBaseUrl, envToken });
  }
}

export async function saveT3SyncConfig(config: T3SyncConfig): Promise<T3SyncConfig> {
  const resolved = resolveT3SyncConfig({
    stored: config,
    envBaseUrl: undefined,
    envToken: undefined,
  });
  await SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(resolved));
  return resolved;
}

function parseStoredConfig(
  raw: string | null,
): { readonly baseUrl?: unknown; readonly token?: unknown } | null {
  if (raw === null || raw.trim().length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
