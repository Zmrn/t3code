import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import { AuthSettingsWriteScope, type EnvironmentId } from "@t3tools/contracts";
import type { EnvironmentPresentation } from "@t3tools/client-runtime/connection";
import { AsyncResult } from "effect/reactivity";

import { appAtomRegistry } from "../../state/atom-registry";
import { environmentPresentations } from "../../state/presentation";
import { serverEnvironment } from "../../state/server";
import { environmentSession, sessionHasScope } from "../../state/session";
import { readUsageHubManagementKey, usageHubSeedPatch } from "./seedUsageHub";

const managementKey = readUsageHubManagementKey(process.env.EXPO_PUBLIC_T3_USAGE_HUB_KEY);

export function installUsageHubSeed(): () => void {
  if (managementKey.length === 0) return () => {};

  let disposed = false;
  const done = new Set<EnvironmentId>();
  const pending = new Set<EnvironmentId>();
  const sessionUnsubs = new Map<EnvironmentId, () => void>();

  const consider = (environmentId: EnvironmentId, presentation: EnvironmentPresentation | null) => {
    if (disposed || done.has(environmentId) || pending.has(environmentId)) return;
    if (presentation === null || presentation.connection.phase !== "connected") return;
    const settings = presentation.serverConfig?.settings;
    if (!settings) return;

    const session = appAtomRegistry.get(environmentSession.sessionStateAtom(environmentId));
    if (!AsyncResult.isSuccess(session)) {
      watchSession(environmentId);
      return;
    }
    if (!sessionHasScope(session, AuthSettingsWriteScope)) {
      done.add(environmentId);
      return;
    }

    const patch = usageHubSeedPatch(settings.usageLimitSources, managementKey);
    if (patch === null) {
      done.add(environmentId);
      return;
    }

    pending.add(environmentId);
    void runAtomCommand(
      appAtomRegistry,
      serverEnvironment.updateSettings,
      { environmentId, input: { patch } },
      { reportFailure: false },
    ).finally(() => {
      pending.delete(environmentId);
      done.add(environmentId);
    });
  };

  const watchSession = (environmentId: EnvironmentId) => {
    if (sessionUnsubs.has(environmentId)) return;
    let unsubscribe = () => {};
    sessionUnsubs.set(environmentId, () => unsubscribe());
    unsubscribe = appAtomRegistry.subscribe(
      environmentSession.sessionStateAtom(environmentId),
      () => {
        consider(
          environmentId,
          appAtomRegistry.get(environmentPresentations.presentationAtom(environmentId)),
        );
      },
    );
  };

  const scan = () => {
    if (disposed) return;
    for (const [environmentId, presentation] of appAtomRegistry.get(
      environmentPresentations.presentationsAtom,
    )) {
      consider(environmentId, presentation);
    }
  };

  const unsubscribe = appAtomRegistry.subscribe(environmentPresentations.presentationsAtom, scan);
  scan();

  return () => {
    disposed = true;
    unsubscribe();
    for (const stop of sessionUnsubs.values()) stop();
    sessionUnsubs.clear();
  };
}
