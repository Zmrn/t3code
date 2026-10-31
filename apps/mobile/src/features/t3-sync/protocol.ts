/**
 * Contract shared with `t3-clirelay-sync/adapters/t3-mobile-discovery/protocol.mjs`.
 * Keep the two copies behavior-identical.
 */

export const DEFAULT_T3_SYNC_BASE_URL = "http://100.104.211.62:8318";
export const T3_SYNC_ENVIRONMENTS_PATH = "/v1/t3/environments";

export interface T3SyncEnvironment {
  readonly machineId: string | null;
  readonly label: string;
  readonly httpBaseUrl: string;
  readonly pairingUrl: string;
}

export interface T3SyncList {
  readonly environments: readonly T3SyncEnvironment[];
  readonly rejected: number;
}

export type ParsedT3SyncList =
  | { readonly ok: true; readonly list: T3SyncList }
  | { readonly ok: false; readonly error: string };

export interface T3SyncFailure {
  readonly label: string;
  readonly error: string;
}

export interface T3SyncReport {
  readonly added: readonly string[];
  readonly skipped: number;
  readonly failures: readonly T3SyncFailure[];
  readonly error: string | null;
}

export interface T3SyncStatus {
  readonly phase: "idle" | "syncing" | "done" | "error";
  readonly message: string | null;
}

export function syncOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(withHttpScheme(trimmed));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

/** Empty input uses the tailnet default. An unparseable value is null. */
export function resolveSyncBaseUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return DEFAULT_T3_SYNC_BASE_URL;
  try {
    const url = new URL(withHttpScheme(trimmed));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function environmentsUrl(baseUrl: string): string {
  return new URL(T3_SYNC_ENVIRONMENTS_PATH, `${baseUrl}/`).toString();
}

export function syncRequestHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  const trimmed = token.trim();
  if (trimmed.length > 0) {
    headers.authorization = `Bearer ${trimmed}`;
    headers["x-t3-sync-token"] = trimmed;
  }
  return headers;
}

export function buildSyncPairingUrl(httpBaseUrl: string, token: string): string | null {
  const origin = syncOrigin(httpBaseUrl);
  const credential = token.trim();
  if (!origin || credential.length === 0) return null;
  const url = new URL(origin);
  url.pathname = "/pair";
  url.hash = new URLSearchParams([["token", credential]]).toString();
  return url.toString();
}

export function parseT3SyncEnvironmentList(body: unknown): ParsedT3SyncList {
  const records = readEnvironmentRecords(body);
  if (records === null) {
    return { ok: false, error: "Sync hub response has no environments list." };
  }

  const environments: T3SyncEnvironment[] = [];
  let rejected = 0;
  for (const record of records) {
    const environment = readEnvironment(record);
    if (environment === null) rejected += 1;
    else environments.push(environment);
  }
  return { ok: true, list: { environments, rejected } };
}

export function selectEnvironmentsToPair(
  environments: readonly T3SyncEnvironment[],
  savedOrigins: ReadonlySet<string>,
): { readonly add: readonly T3SyncEnvironment[]; readonly skipped: number } {
  const seen = new Set(savedOrigins);
  const add: T3SyncEnvironment[] = [];
  let skipped = 0;
  for (const environment of environments) {
    const origin = syncOrigin(environment.httpBaseUrl);
    if (origin !== null && seen.has(origin)) {
      skipped += 1;
      continue;
    }
    if (origin !== null) seen.add(origin);
    add.push(environment);
  }
  return { add, skipped };
}

export function presentSyncReport(report: T3SyncReport): T3SyncStatus {
  if (report.error) return { phase: "error", message: report.error };

  const added = report.added.length === 0 ? null : `Added ${report.added.join(", ")}.`;
  const failed =
    report.failures.length === 0
      ? null
      : report.failures.map((failure) => `${failure.label}: ${failure.error}`).join(" ");
  const skipped =
    report.skipped === 0
      ? null
      : report.added.length === 0 && report.failures.length === 0
        ? report.skipped === 1
          ? "That machine is already on this phone."
          : `All ${report.skipped} machines are already on this phone.`
        : `Skipped ${report.skipped} already on this phone.`;

  if (added === null && skipped === null && failed === null) {
    return { phase: "done", message: "The hub has no machines yet." };
  }

  return {
    phase: failed === null ? "done" : "error",
    message: [added, skipped, failed].filter((part) => part !== null).join(" "),
  };
}

function withHttpScheme(value: string): string {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value) ? value : `http://${value}`;
}

function readEnvironmentRecords(body: unknown): readonly unknown[] | null {
  if (Array.isArray(body)) return body;
  if (!isRecord(body)) return null;
  for (const key of ["environments", "devices", "machines"] as const) {
    const value = body[key];
    if (Array.isArray(value)) return value;
  }
  return null;
}

function readEnvironment(value: unknown): T3SyncEnvironment | null {
  if (!isRecord(value)) return null;

  const token = readString(value, ["bootstrapToken", "pairingToken", "token"]);
  let explicitPairingUrl = readString(value, ["pairingUrl", "pairUrl"]);
  let explicitBase = readString(value, ["httpBaseUrl", "httpUrl", "url", "host"]);
  // A single `url` field may already be the pairing link.
  if (explicitPairingUrl.length === 0 && pairingCredential(explicitBase) !== null) {
    explicitPairingUrl = explicitBase;
    explicitBase = "";
  }
  const baseFromPairing = explicitPairingUrl ? syncOrigin(explicitPairingUrl) : null;
  const httpBaseUrl = syncOrigin(explicitBase) ?? baseFromPairing;
  if (httpBaseUrl === null) return null;

  const pairingUrl =
    explicitPairingUrl.length > 0 ? explicitPairingUrl : buildSyncPairingUrl(httpBaseUrl, token);
  if (pairingUrl === null || pairingCredential(pairingUrl) === null) return null;
  if (syncOrigin(pairingUrl) === null) return null;

  const machineId = readString(value, ["machineId", "id"]);
  const label = readString(value, ["label", "name"]) || new URL(httpBaseUrl).host;
  return {
    machineId: machineId.length > 0 ? machineId : null,
    label,
    httpBaseUrl,
    pairingUrl,
  };
}

function pairingCredential(pairingUrl: string): string | null {
  try {
    const url = new URL(pairingUrl);
    const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
    const token = (hash.get("token") ?? url.searchParams.get("token") ?? "").trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

function readString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
