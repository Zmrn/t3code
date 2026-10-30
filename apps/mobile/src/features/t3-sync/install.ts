import { environmentCatalog } from "../../connection/catalog";
import { appAtomRegistry } from "../../state/atom-registry";
import { runT3EnvironmentSync } from "./sync";

export function installT3EnvironmentSync(): () => void {
  let disposed = false;
  let started = false;
  const catalogAtom = environmentCatalog.catalogValueAtom;

  const start = () => {
    if (disposed || started) return;
    started = true;
    void runT3EnvironmentSync();
  };

  if (appAtomRegistry.get(catalogAtom).isReady) {
    start();
    return () => {
      disposed = true;
    };
  }

  const unsubscribe = appAtomRegistry.subscribe(catalogAtom, (state) => {
    if (!state.isReady) return;
    unsubscribe();
    start();
  });

  return () => {
    disposed = true;
    unsubscribe();
  };
}
