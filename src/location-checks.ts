export type LocationFix={coords:{latitude:number;longitude:number;accuracy:number|null};timestamp:number};
export type LocationCode='INSECURE_CONTEXT'|'UNSUPPORTED'|'POLICY_BLOCKED'|'PERMISSION_DENIED'|'POSITION_UNAVAILABLE'|'TIMEOUT'|'INACCURATE'|'INVALID_FIX'|'STALE_FIX'|'CANCELLED';
export class LocationFailure extends Error {
 constructor(public code:LocationCode,message:string,public accuracyMeters?:number){super(message);this.name='LocationFailure';}
}
export function checkFix(fix:LocationFix,maxAccuracy=100,now=Date.now()){
 if(!fix?.coords)throw new LocationFailure('INVALID_FIX','The location provider returned no position. Choose Retry Location.');
 const {latitude,longitude,accuracy}=fix.coords;
 if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180||accuracy===null||!Number.isFinite(accuracy)||accuracy<0||!Number.isFinite(fix.timestamp))throw new LocationFailure('INVALID_FIX','The location provider returned invalid coordinates or accuracy. The pin was not moved. Retry Location or check your device’s location services.');
 if(now-fix.timestamp>30000||fix.timestamp>now+5000)throw new LocationFailure('STALE_FIX','The provider returned an old or incorrectly dated fix. Check your device clock and choose Retry Location.',accuracy);
 if(accuracy>maxAccuracy)throw new LocationFailure('INACCURATE',`The provider estimates accuracy at ±${Math.ceil(accuracy)} m; this radius needs ±${Math.floor(maxAccuracy)} m or better. This fix was not applied. Try near a window/outdoors, enable Wi-Fi and precise location, or place the pin manually. Windows computers may only provide a coarse network location.`,accuracy);
 return {latitude,longitude,accuracy,timestamp:fix.timestamp};
}
export function locationError(error:{code?:number|string}):LocationFailure {
 if(error instanceof LocationFailure)return error;
 if(error.code===1)return new LocationFailure('PERMISSION_DENIED','The browser reported PERMISSION_DENIED. Allow Location in this site’s address-bar permissions and enable device location services. On Windows, check Settings → Privacy & security → Location, including desktop-app access. Then choose Retry Location. A blocked permission must be changed in browser/OS settings; Retry cannot override it.');
 if(error.code===2)return new LocationFailure('POSITION_UNAVAILABLE','The browser reported POSITION_UNAVAILABLE: its location provider could not obtain a position. Enable device location services and Wi-Fi, check connectivity, and try near a window/outdoors. Desktop computers may have no GPS receiver. Then choose Retry Location.');
 if(error.code===3)return new LocationFailure('TIMEOUT','The location request timed out. Respond to any browser permission prompt, check device location services and Wi-Fi, then choose Retry Location for a fresh request.');
 return new LocationFailure('POSITION_UNAVAILABLE','The location provider failed without a standard error code. Check browser/device location settings and choose Retry Location.');
}
export function gpsDiagnostic(stage:string,details:{code?:string|number;accuracyMeters?:number;ageMs?:number;permission?:string;secure?:boolean;policyAllowed?:boolean}={}){
 // Never pass coordinates, provider error text, profiles, emails, tokens or raw fixes here.
 if(typeof __DEV__!=='undefined'&&__DEV__)console.debug('[GRAVEYARD GPS]',{stage,...details});
}
