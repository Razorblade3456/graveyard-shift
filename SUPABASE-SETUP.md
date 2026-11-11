# GRAVEYARD SHIFT: cloud setup

The code is ready for your Supabase project. **Live Supabase email delivery, Auth configuration, API/RLS behavior on your project, and real-device GPS/sync have not been verified.** Local automated tests are described below. No project or credentials have been invented, and no account, paid service, or hosted deployment has been created.

## 1. Create the backend

1. Create a project in Supabase. A small personal tracker can use the free tier, subject to Supabase's current storage, email, inactivity, and usage limits. Keep the database password private; the app never needs it.
2. Open **SQL Editor**. Paste and run `supabase/migrations/001_sync.sql` once. It creates `gs_workspaces`, per-user Row Level Security policies, and a compare-and-swap function. Do not disable RLS. The function is SECURITY INVOKER and does not accept a user ID; the signed JWT determines the owner.
3. Under **Authentication**, enable email sign-ins and allow new users if you want sign-up. Edit the **Magic Link** email template to include the code, for example `Your GRAVEYARD SHIFT code is {{ .Token }}`. The app uses `signInWithOtp` plus `verifyOtp` with the typed code, so no magic-link callback/deep-link configuration is required for this flow. Use the latest code after resending. Supabase's default email sender is limited; broader use may need your own SMTP configuration.
4. In the project's connection/API settings, copy the **Project URL** and **publishable key** (or legacy **anon** key). Never copy a service-role/secret key, JWT signing secret, or database password into client configuration.

## 2. Configure the app and Netlify

For local development, copy `.env.example` to `.env.local`, then fill in:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Both values are public and included in app bundles; RLS is the access-control boundary. Real `.env` files are ignored by Git. Do not paste credentials into source files or commit them.

Run `npm ci`. Restart Expo after changing environment variables. Web export: `npm run build:web`.

In **Netlify → Project configuration → Environment variables**, add those same two names for the production/build context. Rebuild/redeploy after changing them. Keep the repository root as base, `npm run build:web` as command, `dist` as publish directory, and Node 22. The existing netlify.toml, SPA export, rewrites, and headers are preserved. No server or Netlify Functions are needed. No Netlify dashboard settings were changed automatically.

For an EAS native build, provide the same two public values in your EAS build environment or the environment invoking a local build. They must be present at bundle time. This upgrade adds `expo-secure-store`; **rebuild the native development/production client** before using it. Follow README's Windows/EAS signing instructions. Expo Go and browsers do not support native background geofencing. The existing SDK 54 remains pinned; the upgrade does not change SDKs or native geofence limits.

## 3. First sign-in and safe migration

1. Tap the small cloud indicator in the header. Enter your email, request a code, and enter the code from the email. A missing backend configuration leaves the original local app usable.
2. A signed-in account opens its own device-local cache and synchronizes with its own cloud workspace. **Original browser/SQLite records are not reset, mixed into another account, or uploaded automatically.** Signed-out local tracking remains separate.
3. In Account, choose **Preview import of original local records**. Check the new-profile/new-shift/duplicate counts. Identical records are skipped. ID collisions are mapped deterministically; profile names alone are not treated as identities. Overlapping/invalid imports are blocked for review.
4. Choose **Back up and import**. A durable pre-migration snapshot is stored first, and the app downloads/shares a normal version-2 backup of the original local records before applying the import. Save it safely. If records change during the preview, repeat the preview rather than applying a stale import.
5. Wait for **Synced**. Sign in on the second device using the same email to fetch the records. Each device may preview/import its own original local records separately; duplicates are detected rather than appended blindly.

The original tracker is a retained local copy, not a live mirror of the account. An original active shift also stays unchanged there; after migration, continue tracking in the signed-in workspace, and inspect/correct the retained local shift if you later use the signed-out tracker.

The existing JSON/CSV export/restore controls remain. Account also exports a recovery bundle: it is a restorable version-2 backup of the current account's state with additional `recovery` data containing migration snapshots, pending metadata, and conflicting/concurrent proposals. Recovery sidecars are retained in the downloaded file for manual inspection; ordinary restore imports its top-level state. One rolling pre-merge checkpoint is retained locally, while migration, conflict-resolution, and logout checkpoints are retained separately. Save external backups regularly; storage space is finite.

## 4. How synchronization behaves

- Local writes and the pending marker are persisted together. Native account caches use a separate SQLite database; the original `graveyard-shift.db` is untouched. Browser accounts use separate localStorage keys and keep the original `graveyard-shift-state-v2` key. A failed local write reports an error rather than succeeding in memory.
- Sync runs after pending writes (debounced), every 15 seconds while the app is active, on app resume/browser online events, and best-effort after native geofence clock events. No browser background timer or service worker is used to promise tracking. Pending changes survive restart/sign-out and retry after sign-in on the same device. Native background network work can be suspended; reopening resumes it.
- The server serializes account writes with a row lock and expected revision. Stale uploads do not overwrite a newer revision. Stable IDs survive retries. A three-way merge combines independent record fields and detects edit/edit or deletion/edit conflicts. Deletions are compared to the last acknowledged base, so an offline device cannot silently resurrect a deleted unchanged record.
- Conflicts leave this device's history intact, retain the remote version, and show **Sync Error → Review edits**. Review both values and choose per conflicting field. Cross-record overlaps/profile-deletion conflicts require an explicit version choice. A backup is saved before applying the choice. If either side changes after the preview, refresh the conflict instead of applying stale choices.
- Simultaneous open starts for one profile are combined into the earliest stable active record. Suppressed proposals are retained in the synced recovery list. Independent profiles may run at the same time. More complicated overlaps (including offline closed sessions/corrections) are held for review instead of silently rewriting hours. Globally preventing all conflicting offline actions is impossible; convergence happens when connectivity returns.
- Runtime GPS diagnostics, OS region revision numbers, duplicate-boundary state, and selected-profile preference remain local to each device. Profile identity/settings, saved locations/radius/automation/pay, and shift sources/edits synchronize. Native account-prefixed region IDs reject late events from an old account. Saved automation preference does not mean permission/registration is active on every device.
- Sign-out removes this device's stored session and returns to the original local tracker. Other devices stay signed in. Pending account records stay in that account's local cache, outside the signed-out tracker. Signing back in on the same device resumes them. Session tokens are held in chunked OS SecureStore on native and browser storage on web; they are excluded from record backups. Already-issued server access tokens expire normally; use Supabase session management if a device is lost.
- **Synced** is the state at the last successful exchange, not a guarantee of continuous connectivity or real-time presence. **Syncing**, **Offline**, **Sync Error**, and pending markers explain progress. With no credentials/account, the app says **Local only**. Remote changes may take up to the next synchronization to appear.

Saved location coordinates are uploaded only within your signed-in account, alongside timekeeping records and profile settings. No route/location history is uploaded. Use a trusted browser/device; browser-origin storage and native local files are not an access-control boundary against someone controlling that device or malicious injected code. RLS protects users from other authenticated accounts through the backend.

## 5. GPS behavior

**Web:** Settings → saved location → Start/resume foreground GPS. HTTPS/localhost, a visible page, and browser permission are required. A watcher checks enabled locations, rejects stale/inaccurate fixes, uses the configured radius plus exit hysteresis, and requires two consistent fixes at least 8 seconds apart. Clock time is the first detected fix in the confirmed transition. Hidden/closed pages stop monitoring; stale fixes, uncertainty, unavailable GPS and denied permission never report an active monitor. The next visible page may resume after this browser's explicit opt-in; reloading requires starting foreground GPS again. Manual clocking always remains available. Browser address search/map pin support stays limited to the previously supported native features; current-position lookup still works in supported secure contexts.

**Native:** The existing module-scope Expo TaskManager/geofencing implementation, one-fix accuracy confirmation, notifications, and configured radius are retained. Background events remain OS-controlled; locks, force termination, permission changes and battery restrictions can delay or prevent delivery. Limits remain 20 regions on iOS / 100 on Android. If synced settings exceed this device's capacity, registration fails visibly rather than silently dropping locations; disable GPS on enough profiles and retry. Account switching suspends old registrations and rejects old-account callbacks. No exact physical crossing timestamp is invented when the OS only supplies a delayed event.

## 6. Verify before relying on it

Automated checks: `npm test`, `npm run typecheck`, `npm run build:web`. Tests exercise offline queues, two-device convergence, lost-race/stale CAS retries, concurrent starts, edits during upload, account isolation, logout/cache retention, import deduplication, conflicts, web visibility/accuracy/permission behavior, native task routing, and real SQLite migration. An embedded PostgreSQL (PGlite, test-only dependency) executes the actual migration and verifies anonymous denial, cross-user read/insert/update denial, and stale CAS rejection. It emulates Supabase Auth's `auth.uid()` for those tests; it does **not** verify hosted Auth or email configuration.

After configuring a real project:

1. Sign into web and the native build with the same email; verify code delivery, session persistence, profile/radius/pay edits, manual clocking, and sign-out/relogin. Sign out with pending changes and verify they remain only in that account's cache.
2. Preview/import existing browser/native records; save the backup, repeat import, verify duplicate counts, IDs, overnight records, active shifts and totals. An empty account must not replace queued local history. A missing backend row preserves and reuploads existing account history; an explicit empty cloud history requires review before replacing a previously synced local history.
3. Disconnect one device, add/edit shifts and profiles, reconnect and verify the queued changes arrive. Edit the same shift on both devices and verify conflict review retains both copies. Test deletion versus offline edits.
4. Start the same profile on both devices, synchronize, and verify one canonical active timer and a retained recovery proposal. Verify simultaneous different profiles stay independent.
5. Use a second, different email account and inspect its workspace. Verify it cannot read/update the first account through the API even if it guesses the first user UUID. Check that the migration policies are enabled in the live project. Do not use service-role credentials for this test.
6. For web GPS, grant permission yourself, test visible/hidden tabs and revoked permission, poor accuracy, drift, arrival/departure and manual override. Check status stops claiming active when fixes stop.
7. On a signed iPhone/Android build, test multiple overlapping locations, lock/background/restart/force termination, permission/battery restrictions, geofence capacity, pending sync on unlock, and account switching while a GPS confirmation is in flight.

Live login/email delivery, hosted Supabase policy deployment, multi-device network timing, native signing, and physical GPS have not been exercised without your project/device configuration. Web/native bundle exports check JavaScript packaging, not device behavior.

Official references: [Supabase React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native), [email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions), [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/).
