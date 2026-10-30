import * as NodeAssert from "node:assert/strict";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeTest from "node:test";

import { fetchT3SyncEnvironments } from "./client.mjs";
import { handleDiscoveryRequest } from "./handler.mjs";
import { createFileStore } from "./store.mjs";

async function app() {
  const directory = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "t3-mobile-discovery-"));
  const store = await createFileStore(NodePath.join(directory, "environments.json"));
  const handle = (request, token = "") => handleDiscoveryRequest(request, { store, token });
  return { directory, handle };
}

NodeTest.test("registers a machine and lists it for the phone", async () => {
  const { directory, handle } = await app();
  try {
    const created = await handle(
      new Request("http://hub/v1/t3/environments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          machineId: "botp-acer",
          label: "botp-acer",
          httpBaseUrl: "http://100.80.1.2:3773",
          bootstrapToken: "desktop-bootstrap",
        }),
      }),
    );
    NodeAssert.equal(created.status, 200);

    const listed = await handle(new Request("http://hub/v1/t3/environments"));
    const body = await listed.json();
    NodeAssert.equal(body.environments.length, 1);
    NodeAssert.equal(body.environments[0].machineId, "botp-acer");
    NodeAssert.match(body.environments[0].pairingUrl, /#token=desktop-bootstrap$/);

    const phone = await fetchT3SyncEnvironments({
      baseUrl: "http://hub",
      fetchImpl: async (url, init) => handle(new Request(url, init)),
    });
    NodeAssert.equal(phone.environments[0].label, "botp-acer");
    NodeAssert.equal(phone.rejected, 0);
  } finally {
    await NodeFSP.rm(directory, { recursive: true, force: true });
  }
});

NodeTest.test("a configured hub token is required on either header", async () => {
  const { directory, handle } = await app();
  try {
    const denied = await handle(new Request("http://hub/v1/t3/environments"), "secret");
    NodeAssert.equal(denied.status, 401);

    const allowed = await handle(
      new Request("http://hub/v1/t3/environments", {
        headers: { "x-t3-sync-token": "secret" },
      }),
      "secret",
    );
    NodeAssert.equal(allowed.status, 200);
  } finally {
    await NodeFSP.rm(directory, { recursive: true, force: true });
  }
});

NodeTest.test("upsert replaces the pairing token and delete removes the machine", async () => {
  const { directory, handle } = await app();
  try {
    const publish = (token) =>
      handle(
        new Request("http://hub/v1/t3/environments", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            machineId: "vps",
            httpBaseUrl: "http://100.104.211.62:7433",
            pairingUrl: `http://100.104.211.62:7433/pair#token=${token}`,
          }),
        }),
      );
    await publish("first");
    await publish("second");
    const listed = await (await handle(new Request("http://hub/v1/t3/environments"))).json();
    NodeAssert.equal(listed.environments.length, 1);
    NodeAssert.match(listed.environments[0].pairingUrl, /token=second$/);

    const removed = await handle(
      new Request("http://hub/v1/t3/environments/vps", { method: "DELETE" }),
    );
    NodeAssert.equal(removed.status, 200);
    const after = await (await handle(new Request("http://hub/v1/t3/environments"))).json();
    NodeAssert.deepEqual(after.environments, []);
  } finally {
    await NodeFSP.rm(directory, { recursive: true, force: true });
  }
});

NodeTest.test("paths outside discovery are ignored", async () => {
  const { directory, handle } = await app();
  try {
    NodeAssert.equal(await handle(new Request("http://hub/v1/providers")), null);
  } finally {
    await NodeFSP.rm(directory, { recursive: true, force: true });
  }
});
