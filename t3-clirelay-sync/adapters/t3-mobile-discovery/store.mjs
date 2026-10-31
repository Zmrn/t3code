import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

export function createMemoryStore(environments = []) {
  const byId = new Map(environments.map((environment) => [environment.machineId, environment]));
  return {
    async list() {
      return [...byId.values()].sort((left, right) => left.label.localeCompare(right.label));
    },
    async upsert(environment) {
      byId.set(environment.machineId, environment);
      return environment;
    },
    async remove(machineId) {
      return byId.delete(machineId);
    },
  };
}

export async function createFileStore(filePath) {
  const memory = createMemoryStore(await readEnvironments(filePath));
  let chain = Promise.resolve();
  const write = (operation) => {
    const run = chain.then(operation, operation);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
  return {
    list: () => memory.list(),
    upsert: (environment) =>
      write(async () => {
        const saved = await memory.upsert(environment);
        await persist(filePath, await memory.list());
        return saved;
      }),
    remove: (machineId) =>
      write(async () => {
        const removed = await memory.remove(machineId);
        if (removed) await persist(filePath, await memory.list());
        return removed;
      }),
  };
}

async function readEnvironments(filePath) {
  try {
    const parsed = JSON.parse(await NodeFSP.readFile(filePath, "utf8"));
    return Array.isArray(parsed.environments) ? parsed.environments : [];
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function persist(filePath, environments) {
  await NodeFSP.mkdir(NodePath.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await NodeFSP.writeFile(temporary, `${JSON.stringify({ environments }, null, 2)}\n`);
  await NodeFSP.rename(temporary, filePath);
}
