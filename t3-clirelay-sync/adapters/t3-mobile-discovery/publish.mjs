import { environmentsUrl, syncRequestHeaders } from "./protocol.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, index, all) => {
    if (!arg.startsWith("--")) return pairs;
    pairs.push([arg.slice(2), all[index + 1] ?? ""]);
    return pairs;
  }, []),
);

const hub = args.hub ?? process.env.T3_SYNC_BASE_URL ?? "http://100.104.211.62:8318";
const token = args.token ?? process.env.T3_SYNC_TOKEN ?? "";
const machineId = args["machine-id"];
const httpBase = args["http-base"];
const pairingToken = args["pairing-token"] ?? args["bootstrap-token"] ?? "";
const pairingUrl = args["pairing-url"];
const label = args.label ?? machineId;

if (!machineId || !httpBase || (!pairingUrl && !pairingToken)) {
  process.stderr.write(
    "Usage: node publish.mjs --machine-id ID --http-base http://100.x:3773 (--pairing-url URL | --pairing-token TOKEN) [--label NAME] [--hub URL] [--token SECRET]\n",
  );
  process.exit(1);
}

const response = await fetch(environmentsUrl(hub), {
  method: "POST",
  headers: { ...syncRequestHeaders(token), "content-type": "application/json" },
  body: JSON.stringify({
    machineId,
    label,
    httpBaseUrl: httpBase,
    ...(pairingUrl ? { pairingUrl } : { bootstrapToken: pairingToken }),
  }),
});

const body = await response.text();
process.stdout.write(`${body}\n`);
if (!response.ok) process.exit(1);
