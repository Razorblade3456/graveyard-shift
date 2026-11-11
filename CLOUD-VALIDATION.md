# Cloud / GPS upgrade validation

- TypeScript check passed.
- 57 automated tests passed, including all existing tracking and export regressions.
- Expo web export succeeded with static SPA output for Netlify.
- iOS and Android Hermes bundle exports succeeded; these are not signed native builds.

New tests cover two-device convergence, stable-ID retries, concurrent starts/recovery proposals, account-scoped local caches, offline queue retention and retry, edits during uploads, stale compare-and-swap retries, edit/delete conflicts, empty/reset cloud protection, duplicate import previews, email-code API success/error routing, native SecureStore chunk persistence/removal, native account-prefixed geofence rejection, and foreground browser GPS accuracy/visibility/permission behavior.

The actual SQL migration was executed against embedded PostgreSQL (PGlite), using test auth roles and `auth.uid()` fixtures. Anonymous access was denied; a second user could not select, insert into, or update the first user's workspace. Stale revisions were rejected by the compare-and-swap function. This validates SQL behavior locally, not deployment/security settings on an unconfigured Supabase project.

Not verified without a real Supabase project/device: email delivery/OTP redemption against hosted Auth, deployed project RLS configuration, live multi-device networking, physical GPS/OS task delivery, native signing/install, and interactive browser/native layouts. No external emails were sent, credentials invented, or hosted services deployed. Follow SUPABASE-SETUP.md before relying on cloud sync.
