import { useAtomValue } from "@effect/atom-react";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { AppText as Text, AppTextInput } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { loadT3SyncConfig, saveT3SyncConfig } from "./config";
import { DEFAULT_T3_SYNC_BASE_URL } from "./protocol";
import { runT3EnvironmentSync, t3SyncStatusAtom } from "./sync";

export function T3SyncSection() {
  const status = useAtomValue(t3SyncStatusAtom);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_T3_SYNC_BASE_URL);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- the hub URL lives in secure storage, outside React
  useEffect(() => {
    let cancelled = false;
    void loadT3SyncConfig().then((config) => {
      if (cancelled) return;
      setBaseUrl(config.baseUrl);
      setToken(config.token);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const syncing = status.phase === "syncing";
  const message = formError ?? status.message;

  const onSync = () => {
    if (!ready || syncing) return;
    setFormError(null);
    void (async () => {
      try {
        const saved = await saveT3SyncConfig({ baseUrl, token });
        setBaseUrl(saved.baseUrl);
        setToken(saved.token);
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Could not save the sync hub.");
        return;
      }
      await runT3EnvironmentSync();
    })();
  };

  return (
    <View className="mb-6 gap-3">
      <Text className="px-1 font-t3-medium text-foreground">VPS sync</Text>
      <Text className="px-1 text-sm text-foreground-muted">
        Add machines registered on the sync hub. Sessions open from those environments after they
        pair once.
      </Text>
      <AppTextInput
        accessibilityLabel="Sync hub URL"
        autoCapitalize="none"
        autoCorrect={false}
        value={baseUrl}
        onChangeText={setBaseUrl}
        editable={ready && !syncing}
      />
      <AppTextInput
        accessibilityLabel="Sync token"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        placeholder="Token, if the hub requires one"
        value={token}
        onChangeText={setToken}
        editable={ready && !syncing}
      />
      <Button label="Sync" tone="primary" loading={syncing} disabled={!ready} onPress={onSync} />
      {message ? (
        <Text
          accessibilityRole={status.phase === "error" || formError ? "alert" : undefined}
          className={
            status.phase === "error" || formError
              ? "px-1 text-sm text-danger-foreground"
              : "px-1 text-sm text-foreground-muted"
          }
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}
