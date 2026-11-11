import { LocationFailure } from './location-checks';
export function browserLocationReady(){
 if(!window.isSecureContext)throw new LocationFailure('INSECURE_CONTEXT','Location requires a secure page. Open the direct HTTPS Netlify site (or localhost during development), not an HTTP address or an embedded preview.');
 if(!navigator.geolocation)throw new LocationFailure('UNSUPPORTED','This browser does not provide the Geolocation API. Open the HTTPS site in a current Chrome, Edge, Firefox or Safari browser, or use the native app.');
 const policy=(document as any).permissionsPolicy??(document as any).featurePolicy;
 if(policy?.allowsFeature('geolocation')===false)throw new LocationFailure('POLICY_BLOCKED','This page’s Permissions Policy blocks geolocation. Open the Netlify site directly rather than inside a preview/iframe. The host must allow geolocation for this origin; embedded parents must also grant it.');
}
