import {
  connectionRoutes,
  routeHttpBaseUrl,
  type ConnectionCatalogEntry,
} from "@t3tools/client-runtime/connection";
import { Atom } from "effect/reactivity";

import { environmentCatalog } from "../../connection/catalog";
import { appAtomRegistry } from "../../state/atom-registry";
import { pairEnvironment } from "../../state/use-remote-environment-registry";
import { loadT3SyncConfig, type T3SyncConfig } from "./config";
import { syncDiscoveredEnvironments } from "./discover";
import {
  environmentsUrl,
  parseT3SyncEnvironmentList,
  presentSyncReport,
  syncOrigin,
  syncRequestHeaders,
  type T3SyncReport,
  type T3SyncStatus,
} from "./protocol";

const SYNC_TIMEOUT_MS = 10_000;

export const t3SyncStatusAtom = Atom.make<T3SyncStatus>({ phase: "idle", message: null }).pipe(
  Atom.keepAlive,
  Atom.withLabel("mobile:t3-sync-status"),
);

function savedHttpOrigins(
  entries: ReadonlyMap<unknown, ConnectionCatalogEntry>,
): ReadonlySet<string> {
  const origins = new Set<string>();
  for (const entry of entries.values()) {
    for (const route of connectionRoutes(entry)) {
      const httpBaseUrl = routeHttpBaseUrl(route);
      if (httpBaseUrl === null) continue;
      const origin = syncOrigin(httpBaseUrl);
      if (origin !== null) origins.add(origin);
    }
  }
  return origins;
}

let inFlight: Promise<T3SyncReport> | null = null;

export function runT3EnvironmentSync(): Promise<T3SyncReport> {
  if (inFlight) return inFlight;
  const run = performT3EnvironmentSync().finally(() => {
    if (inFlight === run) inFlight = null;
  });
  inFlight = run;
  return run;
}

async function performT3EnvironmentSync(): Promise<T3SyncReport> {
  appAtomRegistry.set(t3SyncStatusAtom, { phase: "syncing", message: null });
  const config = await loadT3SyncConfig();
  const report = await discoverAndPair(config);
  appAtomRegistry.set(t3SyncStatusAtom, presentSyncReport(report));
  return report;
}

async function discoverAndPair(config: T3SyncConfig): Promise<T3SyncReport> {
  let body: unknown;
  try {
    body = await fetchSyncBody(config);
  } catch (error) {
    return {
      added: [],
      skipped: 0,
      failures: [],
      error: error instanceof Error ? error.message : "Could not reach the sync hub.",
    };
  }

  const parsed = parseT3SyncEnvironmentList(body);
  if (!parsed.ok) return { added: [], skipped: 0, failures: [], error: parsed.error };

  const catalog = await readReadyCatalog();
  const report = await syncDiscoveredEnvironments({
    environments: parsed.list.environments,
    savedOrigins: savedHttpOrigins(catalog.entries),
    pair: (pairingUrl) => pairEnvironment(pairingUrl),
  });
  if (parsed.list.rejected === 0) return report;
  return {
    ...report,
    failures: [
      ...report.failures,
      {
        label: "hub",
        error: `${parsed.list.rejected} ${parsed.list.rejected === 1 ? "entry had" : "entries had"} no pairing token.`,
      },
    ],
  };
}

async function fetchSyncBody(config: T3SyncConfig): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(environmentsUrl(config.baseUrl), {
      headers: syncRequestHeaders(config.token),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Sync hub refused the token."
          : `Sync hub returned ${response.status}.`,
      );
    }
    try {
      return await response.json();
    } catch (error) {
      throw new Error("Sync hub returned a response that is not JSON.", { cause: error });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The sync hub did not respond.", { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function readReadyCatalog() {
  const catalogAtom = environmentCatalog.catalogValueAtom;
  const current = appAtomRegistry.get(catalogAtom);
  if (current.isReady) return Promise.resolve(current);
  return new Promise<typeof current>((resolve) => {
    let settled = false;
    const finish = (state: typeof current) => {
      if (settled || !state.isReady) return;
      settled = true;
      unsubscribe();
      resolve(state);
    };
    const unsubscribe = appAtomRegistry.subscribe(catalogAtom, finish);
    finish(appAtomRegistry.get(catalogAtom));
  });
}
