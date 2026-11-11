# Location detection fix

## Confirmed causes in the installed implementation

1. Settings called Expo Location's `getCurrentPositionAsync({accuracy: High})` on web. In the project's installed SDK 54 adapter (`node_modules/expo-location/src/ExpoLocation.web.ts`), this defaults to `maximumAge: Infinity`. A browser could therefore return an indefinitely cached fix; repeating the operation did not require a fresh one.
2. Before obtaining coordinates, Settings called `requestForegroundPermissionsAsync`. The installed web adapter requires `navigator.permissions.query`, which is unavailable/unsupported in some browser configurations. Its permission-prompt path also calls `getCurrentPosition` without high-accuracy/timeout options, and non-permission provider errors return `granted: false`. Settings then labeled that result “permission denied,” losing the actual reason.
3. `WorkplaceMap.web.tsx` returned null, and App.tsx only rendered maps when the platform was iOS. A successful coordinate request could never position a visible web map pin or show a radius circle.
4. Failed accuracy checks discarded the measured accuracy. There was no dedicated fresh Retry action. The foreground watcher also needed stronger validation and per-profile monitoring status instead of a shared status that could become misleading after stale/invalid fixes.

These are inspected code defects, not a claim that a particular browser's OS permissions or physical location provider have been verified remotely. A Netlify/browser permission/provider failure must still be identified using the actual error code.

## What changed

- Web Settings now calls the browser Geolocation API directly from **Use My Current Location** and **Retry Location**: `enableHighAccuracy: true`, `maximumAge: 0`, and a 20-second provider timeout. A separate 25-second watchdog also covers a permission prompt left unanswered. Permission queries are optional diagnostics, never a prerequisite. Late/cancelled requests cannot update another profile/account's pin.
- Secure context, API support and exposed Permissions Policy are checked. PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT, inaccurate, invalid and stale fixes have separate actionable messages. Retry always starts a new request; it cannot bypass a deliberately blocked browser/OS permission.
- Location accuracy is shown in meters. Detection requires accuracy within half the radius and no worse than 100 m, a valid coordinate range, and a fix no older than 30 seconds. An unreliable fix leaves the existing draft/saved location unchanged. Native Settings retains Expo Location and receives the same verification/error treatment.
- A web-only Leaflet map replaces the null stub. Verified detection recenters the real draggable pin and configured radius circle; map clicks/dragging support deliberate manual placement. Save workplace applies the draft to the selected existing profile through the original storage/cloud-sync path. Example coordinates cannot be accidentally saved without selecting a location.
- OpenStreetMap tiles use HTTPS/CORS with visible attribution. The provider's world-tile response was checked and returned HTTP 200 plus `Access-Control-Allow-Origin: *`, compatible with the existing Netlify COEP header. Tile failure does not disable pin/radius geometry or tracking. Standard browser caching/referrer behavior is retained; no tile prefetch/offline downloading is added. Street-map requests reveal the viewed map area to the tile provider, as with normal map services.
- Netlify explicitly allows same-origin geolocation with `Permissions-Policy: geolocation=(self)` while retaining build settings, rewrites and existing isolation headers. This cannot override browser/OS denial or a more restrictive embedding parent; use the direct HTTPS site.
- Foreground geofencing validates fixes before any state mutation, requires two consistent fresh samples over at least eight seconds, resets uncertain/stale evidence, and tracks verification per profile. Expired fixes never report active monitoring. Hidden pages stop watching; no background browser tracking is claimed.
- Development-only `[GRAVEYARD GPS]` diagnostics report request stage, standard error code, permission state when available, accuracy and age. They never log coordinates, provider raw messages, profile/account data or auth tokens, and do not upload telemetry. Production builds do not emit these debug diagnostics.

## Use it

1. Deploy the new commit to Netlify and open its direct **HTTPS** URL in a current browser.
2. Open Settings, choose the profile, then **Use My Current Location**. Allow location in the browser prompt yourself. Inspect the accuracy and map pin.
3. If inaccurate/failed, read the code and guidance; **Retry Location** makes a fresh request. For a blocked site, change the browser's location permission first. On Windows, also check Settings → Privacy & security → Location and desktop-app access. Wi-Fi/precise location can help; a GPS-less desktop may only supply a coarse network estimate. The app cannot manufacture a precise fix the device/provider does not have.
4. Confirm or manually position the pin, adjust radius, and **Save workplace**. Saving disables automation for that edited profile until enabled again. Other profiles/history remain intact. Changing the draft alone never clocks a shift.
5. Choose **Start / resume foreground GPS** for web automation. Keep the page visible. Current-location setup and continuous foreground monitoring are separate actions; neither implies background support.

## Verification and limits

Tests cover browser support without Permissions API, permission/provider/timeouts, cache-bypassing retries, malformed/coarse/stale fixes, prompt watchdog, cancellation, coordinate-free diagnostics, native Expo permission handling, foreground visibility/expiry/profile isolation, and actual React/Leaflet pin/radius updates in a DOM test. Existing cloud/account/history tests remain in the suite. Web and native bundle exports check packaging; physical GPS accuracy, interactive browser/phone behavior and a live Netlify deployment cannot be certified by mocks or DOM tests.

The Leaflet stylesheet is bundled locally with its BSD-2-Clause license; unused default marker/layer image URLs are removed because the app uses a custom div-icon pin, avoiding Metro's unresolved-image warnings. Native map components are unchanged. No storage-schema migration or records reset is introduced.

References: [installed Expo web location adapter](https://github.com/expo/expo/blob/sdk-54/packages/expo-location/src/ExpoLocation.web.ts), [browser geolocation options](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition), [Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/geolocation), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).
