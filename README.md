# GRAVEYARD SHIFT

A native, local-first personal time tracker for iPhone and Android. Five compact sections: Home, Profiles, History, Stats, Settings. Profiles are independent trackers, never login accounts. No app account, backend, subscription, or continuous route recording. Built with React Native, Expo SDK 54, and TypeScript. SDK 54 is deliberately pinned with its compatible native dependency versions in package-lock.json.

## Windows 11 → iPhone

Install Node.js 22 LTS and Git. Open PowerShell in this project folder:

```powershell
npm ci
npm test
npm run typecheck
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest device:create
npx eas-cli@latest build --profile development --platform ios
```

Choose your own unique iOS bundle identifier in app.json before configuring signing. Follow EAS prompts to associate the project, register your iPhone, and set up Apple credentials. Open the completed build's installation link on the registered iPhone, install it, and enable Developer Mode if prompted. Then, on Windows:

```powershell
npm start
```

Keep Windows and the phone on the same network. Open the development client and scan the Metro QR code. Allow Node through Windows Firewall for your private network. If LAN connectivity fails, use `npx expo start --dev-client --tunnel` (may prompt to install a tunnel dependency).

**Expo Go does not support this app's native background geofencing.** Use the development build above, or a standalone preview/production build. Windows cannot run Xcode or an iOS simulator. EAS cloud signing for a physical iPhone needs an Expo developer account and Apple Developer Program membership; these are build/distribution requirements, not app accounts. Apple membership may cost money. A Mac with Xcode offers local building/signing alternatives; free personal signing has limitations.

For everyday use without Metro, build an internal standalone app:

```powershell
npx eas-cli@latest build --profile preview --platform ios
```

Install from its build link on the registered device. It contains the JS bundle and operates offline. Provisioning profiles expire and may need renewal. Production App Store/TestFlight distribution requires Apple signing and the corresponding distribution steps; no signing or remote deployment has been performed by this project.

Official setup: [Expo iOS device builds](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## Android

Install Android Studio, Android SDK/JDK, and enable USB debugging. With a connected device or emulator, run `npm run android`. Alternatively run `npx eas-cli@latest build --profile preview --platform android` for an installable internal APK. Background permission may require opening system settings and choosing “Allow all the time.” Disable restrictive battery management for field testing.

Android supports address search and current-GPS workplace selection. The interactive map/pin and radius preview are iPhone-only, avoiding a Google Maps key or paid map service requirement on Android. Saved coordinates and radius work on both platforms. iPhone uses the system map. No browser companion is included; browsers cannot reliably run background geofences.

## Profiles and locations (v1.1)

- Open Profiles → New profile. Give it a name, color (swatch or hex), icon (glyph or emoji), and category: Work, Personal, Fitness, Study, or Custom. Leave the hourly rate blank for unpaid activities. Profiles have no app-imposed count limit.
- Tap a profile card to switch Home instantly. Every other active timer and enabled GPS location continues independently. Use its Clock in/out button directly on the Profiles screen too.
- Location & GPS opens Settings for that profile. Saving a location/radius disables only that profile’s automation until you enable it again. Remove location keeps its history and manual tracking. A location and hourly pay are both optional.
- History/calendar and Stats have a horizontal profile filter, including archived profiles, and All profiles for combined totals. Combined hours **sum tracked profile time**, so simultaneous activities count toward each profile and can exceed 24 hours per day in combined views. Earnings use each profile’s own rate; unpaid profiles contribute zero.
- Edit changes identity/pay without changing records or GPS settings. Archive requires closing active shifts, retains history and disables GPS. Show archived profiles to restore one; GPS remains off until explicitly enabled. Delete confirms the profile name and shift count, then permanently removes only that profile and its history. Close active shifts first. Keep at least one unarchived profile.
- Device GPS capacity is **20 on iOS / 100 on Android**. The app rejects enabling another location at capacity before modifying existing registrations; nothing is silently dropped or rotated. All enabled locations are submitted together. Registered counts and individual monitoring status are checked against TaskManager’s actual region options, background permission, and GPS services. A failed registration leaves a visible warning and Retry control; an enabled switch alone does not mean a region is registered.
- Identical/overlapping circles are valid: profile/revision-specific region IDs route each arrival/departure to its own tracker. Duplicate events and manual overrides are isolated per profile. Boundary processing is serialized per profile; different profiles remain independent. Deleted, archived, disabled, and obsolete-revision events are ignored.

The existing SQLite database upgrades transactionally on first launch. Your previous workplace, pay, automation preference, original shift IDs, times, sources, edits and open shift become one default profile. Startup reconciles its native region registration; review the status after upgrading. Switching profiles does not re-register fences.

JSON backups now use version 2 and include every profile plus all history. Both version 1 and version 2 backups can be restored; all restored GPS switches are off until enabled again. CSV includes Profile ID, name, category, and historical workplace; History exports the active filter, while Settings exports all profiles. Duplicate profile names remain distinguishable by ID.

The geofence capacities follow [Expo Location’s documented platform limits](https://docs.expo.dev/versions/latest/sdk/location/). Native task behavior still needs physical-device testing.

## First shift

1. Settings → name your workplace; search its address, use current GPS, or tap/drag the iPhone map pin. Default radius: 200 m; adjustable 100–1,000 m with feet display available. Save.
2. Enable Automatic clocking. Read the explanation and grant foreground then background location. On iPhone select Always and Precise Location in phone settings as needed. Notifications are a separate, optional permission.
3. Confirm the status says “Geofence registered · OS monitoring.” This means registration, GPS services, and background permission were checked; it does not guarantee delivery of the next event.
4. Clock manually anytime. History → select a day → tap a shift to correct it, or add a missing shift. The Home correction button opens the current/latest shift. Edit end dates explicitly for overnight shifts; dates/times are local `YYYY-MM-DDTHH:mm`.
5. Export CSV for Excel; use JSON Backup for full restoration. Save the shared file to Files/OneDrive or another safe location. CSV uses ISO timestamps with timezone information (UTC `Z`), not local formatted dates. Active shifts have blank ends and duration. Restore replaces local data after confirmation and turns automation off.

## Reliability and privacy

Native `expo-location` geofencing is defined at module scope through `expo-task-manager`. Registration is reconciled against actual permissions/services on app resume. Changing a profile’s workplace replaces its region revision, disables only its fence, and asks you to enable it again; other profiles retain their settings. Existing shifts retain the original workplace name. All writes use synchronous SQLite transactions, shared by foreground and headless tasks. There is no location-upload code; native map and address services may contact the phone's map/geocoding provider when used.

Each OS boundary event requests one fresh position. Accuracy must be ≤100 m and ≤half the radius. Arrivals must be confidently inside; exits must be beyond the radius plus a 30 m / 15% margin, including accuracy uncertainty. Stale/inaccurate fixes are rejected and a review message is saved. Rejected events are **not retried automatically**, so conservative drift protection can miss a real departure near the boundary. Increase your radius if GPS is poor and inspect/correct shifts. No continuous background GPS sampling or route history is collected.

Times are the app's **event receipt time**, not a claimed exact physical crossing time: the native event payload does not expose that timestamp. OS delays, force quitting, reboot, background refresh, device battery restrictions, and missing permission can delay or prevent an event. Initial region state may be delivered when enabling the fence. Changing workplaces does not close an open shift; do that manually if appropriate. Notifications never roll back a saved shift. Manual overrides persist across repeated events for the same boundary; the next opposite confirmed boundary allows the following arrival/departure again.

Durations use elapsed milliseconds, including overnight and daylight-saving transitions. Daily/weekly/monthly totals clip shifts to local calendar boundaries. Weeks start Monday. Gross earnings are a simple hours × rate estimate before taxes, overtime or unpaid breaks. No payroll compliance rules are implied.

Records survive app restarts, but uninstalling deletes the database. Device/OS backups may also copy app data according to your phone settings. Export backups regularly. Never rely on the app as the sole payroll record before device testing.

References: [Expo Location](https://docs.expo.dev/versions/v54.0.0/sdk/location/), [TaskManager](https://docs.expo.dev/versions/v54.0.0/sdk/task-manager/), [SQLite](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/).

## Testing

`npm test` covers clock transitions, duplicate events, manual overrides, overnight clipping, multiple shifts, serialized reopen state, manual correction validation, GPS drift/accuracy, and CSV escaping. `npm run typecheck` checks the native code.

In a development build, Settings contains GPS simulator buttons for the selected profile. These use a synthetic accurately inside/outside distance, the real boundary predicate, clock reducer, and persistent database. They change actual local records; back up first. They do not prove native OS dispatch. Unit tests cover inaccurate and ambiguous positions. Multi-profile tests cover legacy migration, simultaneous timers, scoped edits/totals/earnings, profile lifecycle, backup restoration, unlimited manual profiles, and both geofence capacities. Native adapter tests invoke the actual task callback with mocked Expo APIs to verify routing, duplicate suppression, registration failures, revoked permissions, stale-region rejection and preservation of other fences. A real in-memory SQLite test verifies transactional migration, reopen and rollback (Node 22’s experimental node:sqlite). Mocks do not replace device testing. Simulator controls are excluded from release builds.

Before trusting automation on a real phone:

- Enter/leave a saved radius while foregrounded, locked, and backgrounded; confirm one event and correct time/source per transition.
- Repeat events, manually clock out inside, leave and return; check no duplicate shifts.
- Deny permissions, disable GPS, turn off background refresh, test poor reception and force termination. Verify warning/status behavior and manual recovery.
- Restart the app and phone; check registration before relying on automation. Re-enable when necessary.
- Enable two identical/overlapping locations and verify separate notifications, timers and records. Switch profiles while locked/backgrounded and verify both continue.
- Change one workplace with an open shift; verify old events cannot change records and unrelated fences remain registered.
- Fill all 20 iPhone / 100 Android slots, attempt one more, and confirm the previous regions remain intact. Revoke permissions and verify monitoring warnings.
- Archive/restore/delete profiles; cancel a deletion and verify no data changes. Upgrade with existing v1 records; export/restore both backup versions and verify filters and combined totals.
- Edit/add/delete overnight shifts; reject overlaps; export, uninstall only after backup, reinstall and restore.
- Check map rendering, native notifications, file sharing/restoration, small-screen layouts and large text on iPhone and Android.

No physical phone, native signing, or OS-level geofence delivery was available during implementation. TypeScript and Metro bundling cannot verify those behaviors.
