import { environmentsUrl, parseT3SyncEnvironmentList, syncRequestHeaders } from "./protocol.mjs";

export async function fetchT3SyncEnvironments(input) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 10_000);
  try {
    const response = await fetchImpl(environmentsUrl(input.baseUrl), {
      headers: syncRequestHeaders(input.token ?? ""),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Sync hub refused the token."
          : `Sync hub returned ${response.status}.`,
      );
    }
    let body;
    try {
      body = await response.json();
    } catch (error) {
      throw new Error("Sync hub returned a response that is not JSON.", { cause: error });
    }
    const parsed = parseT3SyncEnvironmentList(body);
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.list;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The sync hub did not respond.", { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
