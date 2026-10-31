import { resolveSyncBaseUrl, DEFAULT_T3_SYNC_BASE_URL } from "./protocol";

export interface T3SyncConfig {
  readonly baseUrl: string;
  readonly token: string;
}

export function resolveT3SyncConfig(input: {
  readonly stored: { readonly baseUrl?: unknown; readonly token?: unknown } | null;
  readonly envBaseUrl: string | undefined;
  readonly envToken: string | undefined;
}): T3SyncConfig {
  if (input.stored) {
    return {
      baseUrl:
        resolveSyncBaseUrl(typeof input.stored.baseUrl === "string" ? input.stored.baseUrl : "") ??
        DEFAULT_T3_SYNC_BASE_URL,
      token: typeof input.stored.token === "string" ? input.stored.token.trim() : "",
    };
  }
  return {
    baseUrl: resolveSyncBaseUrl(input.envBaseUrl) ?? DEFAULT_T3_SYNC_BASE_URL,
    token: input.envToken?.trim() ?? "",
  };
}
