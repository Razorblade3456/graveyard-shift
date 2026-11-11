# GRAVEYARD SHIFT 1.1 validation

Verified November 10, 2026:

- `npm run typecheck` — passed.
- `npm test` — 29 tests passed, 0 failed.
- `expo export --platform ios --platform android --max-workers 2` — both Hermes bundles exported successfully.

Coverage includes the original clock-state/calculation regressions, migration from the previous single-workplace schema, concurrent timers and identical locations, profile-scoped corrections and earnings, unlimited manual profiles, iOS/Android geofence capacity checks, archival/deletion safeguards, CSV profile identity, and old/new backup compatibility.

Native-adapter tests execute the actual TaskManager callback with mocked Expo APIs. They verify region registration/routing, duplicate suppression, permission revocation, registration failure visibility, obsolete/deleted region rejection, inaccurate GPS handling, and preserving another profile's fence when archiving. A real Node SQLite in-memory database verifies migration, reopening persisted records, and transactional rollback. SQLite and TypeScript stripping produce Node experimental-feature notices; tests pass.

Not verified: native Xcode/Gradle compilation/signing, physical-device installation, background OS event delivery and battery restrictions, on-device maps/notifications/sharing, and visual/accessibility layout on real iPhone/Android devices. Bundle export is not a signed native build. Follow the physical-device checklist in README.md before relying on automation.
