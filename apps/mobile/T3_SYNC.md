# Android sync with a self-hosted t3-sync hub

The phone asks the hub for registered T3 machines and pairs any that are not already saved. After that, the normal environment list shows their sessions. This does not use T3 Connect, and it does not sync provider credentials.

The contract of record is [Zmrn/t3-clirelay-sync](https://github.com/Zmrn/t3-clirelay-sync) (`docs/t3-mobile-discovery.md`, `adapters/t3-mobile-discovery`). This checkout vendors that tree at `t3-clirelay-sync/` because the agent token cannot create the GitHub repo. The app copy is `apps/mobile/src/features/t3-sync/`. Keep `protocol.ts` behavior-identical with `t3-clirelay-sync/adapters/t3-mobile-discovery/protocol.mjs`.

## Config

Default hub: `http://100.104.211.62:8318`

Build-time overrides (repository-root `.env`, before the JS bundle is built):

- `EXPO_PUBLIC_T3_SYNC_BASE_URL`
- `EXPO_PUBLIC_T3_SYNC_TOKEN` (omit when the hub is open on the tailnet)

Environments → **VPS sync** saves a hub URL and token on the phone. A saved value wins over the build-time variables. An empty saved token means the hub is called with no token.

On launch, and when you press **Sync**, the app `GET`s `{hub}/v1/t3/environments`. Each new machine is paired with the existing pairing flow (`/pair#token=…` exchanged for a bearer). Machines already saved, matched by HTTP origin, are left alone so a one-time pairing code is not spent again.

Cleartext HTTP is already allowed by `plugins/withAndroidNetworkSecurityConfig.cjs`, which Tailscale `http://100.x` addresses need.

## Hub response

`GET /v1/t3/environments`

Optional auth: `Authorization: Bearer <token>` and `X-T3-Sync-Token: <token>`.

```json
{
  "environments": [
    {
      "machineId": "botp-acer",
      "label": "botp-acer",
      "httpBaseUrl": "http://100.80.1.2:3773",
      "pairingUrl": "http://100.80.1.2:3773/pair#token=PAIRING_OR_DESKTOP_BOOTSTRAP"
    }
  ]
}
```

`bootstrapToken` plus `httpBaseUrl` is enough when `pairingUrl` is absent. `devices` and `machines` are accepted as the list name. Entries with no token are skipped.

Publish with `POST /v1/t3/environments` and the same fields. `machineId` upserts. The token inside `pairingUrl` is what the phone redeems, so prefer a pairing link minted for mobile (or the desktop bootstrap token, which the server can exchange more than once). A one-time code works for the first phone that syncs; later syncs skip that origin.

Desktop provider sync stays a different path. This list is T3 environments only.

## Build an installable APK on Windows (botp-acer)

Node `26.12.1` and pnpm `12.14.0` (see the root `package.json`). JDK 17 or newer (`JAVA_HOME`). Android SDK packages `platforms;android-37.0`, `build-tools;37.0.0`, and `ndk;27.1.12297006` (compileSdk 37 in `react-native/gradle/libs.versions.toml` for this checkout).

```bat
cd t3code
corepack enable
corepack prepare pnpm@12.14.0 --activate
pnpm install --frozen-lockfile

cd apps\mobile
set EXPO_NO_GIT_STATUS=1
set APP_VARIANT=development
set EXPO_PUBLIC_T3_SYNC_BASE_URL=http://100.104.211.62:8318
npx expo prebuild --clean --platform android

cd android
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17
gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

APK (JS bundled, no Metro):

`apps\mobile\android\app\build\outputs\apk\release\app-release.apk`

`assembleDebug` is a dev client and waits for Metro, so it will not run this sync code on its own. Release is signed with the debug keystore Expo generates, which is enough for `adb install -r`. It is not a Play Store signature.

Install: `adb install -r` that file. The phone must be on the same tailnet as `100.104.211.62`. Open Environments, press **Sync**, then open a machine's threads. The first launch also syncs on its own.

## Usage hub seed

Usage limit sources are stored on each connected T3 machine, not in a separate phone list. Desktop Settings → Add hub writes the same `usageLimitSources` record. A private Android build can write the CliRelay hub when that machine's settings do not already have `http://100.104.211.62:8318` with a management key.

The key is read from `EXPO_PUBLIC_T3_USAGE_HUB_KEY` while Metro bundles the release JS. It is not in source. A build without the variable does not seed.

Windows, in the same command prompt as Gradle:

```bat
set EXPO_PUBLIC_T3_USAGE_HUB_KEY=the-management-key
gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

The shell value is inlined into that APK. Do not commit it, and do not publish that APK on a public release.

After the phone pairs a machine, Usage can show that hub's Claude and Codex accounts without Add hub. The machine's T3 server still has to reach the hub. A provider JSON-RPC `-32600` is unchanged by this seed.

## 给 Botp

手机启动后仍会自动拉取 `http://100.104.211.62:8318/v1/t3/environments` 并配对机器。带管理密钥的私有包还会在对方设置里还没有这个 hub 时写入 CliRelay 用量源，Usage 里应出现该 hub 的 Claude 和 Codex 账号，不用再点 Add hub。Provider 的 JSON-RPC `-32600` 仍会出现，这是预期。安装 release APK 后打开 Usage 即可查看。密钥只在打包时注入，不要提交到公开仓库。
