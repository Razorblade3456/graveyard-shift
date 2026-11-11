import { checkFix, gpsDiagnostic, LocationFailure, locationError } from './location-checks';
import { browserLocationReady } from './web-geolocation';
export function getCurrentLocation({radius,signal}:{radius:number;signal?:AbortSignal}){
 return new Promise<ReturnType<typeof checkFix>>((resolve,reject)=>{
  try{browserLocationReady();}catch(e){gpsDiagnostic('preflight-failed',{code:(e as LocationFailure).code,secure:window.isSecureContext});reject(e);return;}
  if(signal?.aborted){reject(new LocationFailure('CANCELLED','Location request cancelled.'));return;}
  let settled=false;
  const finish=(fn:()=>void)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);fn();};
  const cancel=()=>finish(()=>reject(new LocationFailure('CANCELLED','Location request cancelled.')));
  const timer=setTimeout(()=>finish(()=>{gpsDiagnostic('request-failed',{code:'TIMEOUT'});reject(locationError({code:3}));}),25000);
  signal?.addEventListener('abort',cancel);
  gpsDiagnostic('request-started',{secure:window.isSecureContext});
  // Permissions.query is diagnostic only. Safari/older browsers may not implement it.
  // The actual geolocation call below requests permission directly, with no gate or cache.
  try{void navigator.permissions?.query({name:'geolocation'}).then(p=>gpsDiagnostic('permission-observed',{permission:p.state})).catch(()=>gpsDiagnostic('permission-query-unavailable'));}catch{gpsDiagnostic('permission-query-unavailable');}
  try{navigator.geolocation.getCurrentPosition(fix=>{
   if(settled)return;
   try{const result=checkFix(fix,Math.min(100,radius/2));finish(()=>{gpsDiagnostic('request-verified',{accuracyMeters:result.accuracy,ageMs:Date.now()-fix.timestamp});resolve(result);});}
   catch(e){const failure=e as LocationFailure;finish(()=>{gpsDiagnostic('fix-rejected',{code:failure.code,accuracyMeters:failure.accuracyMeters});reject(e);});}
  },error=>finish(()=>{const failure=locationError(error);gpsDiagnostic('request-failed',{code:error.code});reject(failure);}),{enableHighAccuracy:true,maximumAge:0,timeout:20000});}
  catch(e){finish(()=>{gpsDiagnostic('request-threw',{code:'POSITION_UNAVAILABLE'});reject(locationError({}));});}
 });
}
