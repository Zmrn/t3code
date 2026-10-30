import { selectEnvironmentsToPair, type T3SyncEnvironment, type T3SyncReport } from "./protocol";

export async function syncDiscoveredEnvironments(input: {
  readonly environments: readonly T3SyncEnvironment[];
  readonly savedOrigins: ReadonlySet<string>;
  readonly pair: (
    pairingUrl: string,
  ) => Promise<{ readonly ok: boolean; readonly error: string | null }>;
}): Promise<T3SyncReport> {
  const selected = selectEnvironmentsToPair(input.environments, input.savedOrigins);
  const added: string[] = [];
  const failures: T3SyncReport["failures"][number][] = [];
  for (const environment of selected.add) {
    const outcome = await input.pair(environment.pairingUrl);
    if (outcome.ok) added.push(environment.label);
    else failures.push({ label: environment.label, error: outcome.error ?? "Could not pair." });
  }
  return { added, skipped: selected.skipped, failures, error: null };
}
