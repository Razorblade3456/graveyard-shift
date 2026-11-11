import * as Location from 'expo-location';
import { checkFix, gpsDiagnostic, LocationFailure } from './location-checks';
export async function getCurrentLocation({radius,signal}:{radius:number;signal?:AbortSignal}){
 if(!(await Location.requestForegroundPermissionsAsync()).granted)throw new LocationFailure('PERMISSION_DENIED','Location permission was denied. Allow precise location for GRAVEYARD SHIFT in phone settings, then retry.');
 if(!await Location.hasServicesEnabledAsync())throw new LocationFailure('POSITION_UNAVAILABLE','Device location services are disabled. Enable them in phone settings and retry.');
 return new Promise<ReturnType<typeof checkFix>>((resolve,reject)=>{
  if(signal?.aborted){reject(new LocationFailure('CANCELLED','Location request cancelled.'));return;}
  let settled=false;const finish=(fn:()=>void)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);fn();};
  const cancel=()=>finish(()=>reject(new LocationFailure('CANCELLED','Location request cancelled.')));
  const timer=setTimeout(()=>finish(()=>reject(new LocationFailure('TIMEOUT','Device GPS timed out. Try near a window/outdoors and choose Retry Location.'))),25000);signal?.addEventListener('abort',cancel);
  Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High}).then(fix=>{if(settled)return;try{const result=checkFix(fix,Math.min(100,radius/2));finish(()=>resolve(result));}catch(e){finish(()=>reject(e));}},()=>finish(()=>reject(new LocationFailure('POSITION_UNAVAILABLE','The device could not obtain a location. Check location services and connectivity, then choose Retry Location.'))));
 });
}
