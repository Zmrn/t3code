/**
 * Contract shared with the T3 Code fork
 * `apps/mobile/src/features/t3-sync/protocol.ts`.
 * Keep the two copies behavior-identical.
 */

export const DEFAULT_T3_SYNC_BASE_URL = "http://100.104.211.62:8318";
export const T3_SYNC_ENVIRONMENTS_PATH = "/v1/t3/environments";

export function syncOrigin(value) {
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
export function resolveSyncBaseUrl(value) {
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

export function environmentsUrl(baseUrl) {
  return new URL(T3_SYNC_ENVIRONMENTS_PATH, `${baseUrl}/`).toString();
}

export function syncRequestHeaders(token) {
  const headers = { accept: "application/json" };
  const trimmed = token.trim();
  if (trimmed.length > 0) {
    headers.authorization = `Bearer ${trimmed}`;
    headers["x-t3-sync-token"] = trimmed;
  }
  return headers;
}

export function buildSyncPairingUrl(httpBaseUrl, token) {
  const origin = syncOrigin(httpBaseUrl);
  const credential = token.trim();
  if (!origin || credential.length === 0) return null;
  const url = new URL(origin);
  url.pathname = "/pair";
  url.hash = new URLSearchParams([["token", credential]]).toString();
  return url.toString();
}

export function parseT3SyncEnvironmentList(body) {
  const records = readEnvironmentRecords(body);
  if (records === null) {
    return { ok: false, error: "Sync hub response has no environments list." };
  }

  const environments = [];
  let rejected = 0;
  for (const record of records) {
    const environment = readEnvironment(record);
    if (environment === null) rejected += 1;
    else environments.push(environment);
  }
  return { ok: true, list: { environments, rejected } };
}

export function selectEnvironmentsToPair(environments, savedOrigins) {
  const seen = new Set(savedOrigins);
  const add = [];
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

export function presentSyncReport(report) {
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

function withHttpScheme(value) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value) ? value : `http://${value}`;
}

function readEnvironmentRecords(body) {
  if (Array.isArray(body)) return body;
  if (!isRecord(body)) return null;
  for (const key of ["environments", "devices", "machines"]) {
    const value = body[key];
    if (Array.isArray(value)) return value;
  }
  return null;
}

function readEnvironment(value) {
  if (!isRecord(value)) return null;

  const token = readString(value, ["bootstrapToken", "pairingToken", "token"]);
  let explicitPairingUrl = readString(value, ["pairingUrl", "pairUrl"]);
  let explicitBase = readString(value, ["httpBaseUrl", "httpUrl", "url", "host"]);
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

function pairingCredential(pairingUrl) {
  try {
    const url = new URL(pairingUrl);
    const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
    const token = (hash.get("token") ?? url.searchParams.get("token") ?? "").trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

function readString(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return "";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
