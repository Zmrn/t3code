# t3-clirelay-sync

Self-hosted hub for Botp's tailnet. Sync listens at `http://100.104.211.62:8318`. Headless T3 is `http://100.104.211.62:7433`. CliRelay is `:8317`.

This directory is the kit of record for Android discovery. Publish it as [Zmrn/t3-clirelay-sync](https://github.com/Zmrn/t3-clirelay-sync). The cloud agent token for the T3 Code fork cannot create that repository (`createRepository` is not granted), so the tree is committed here until it can be pushed on its own.

Android discovery of remote T3 environments (not providers) is `adapters/t3-mobile-discovery` and [docs/t3-mobile-discovery.md](docs/t3-mobile-discovery.md). The phone-side copy of `protocol.mjs` is `apps/mobile/src/features/t3-sync/protocol.ts`.
