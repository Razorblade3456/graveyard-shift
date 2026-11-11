import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { changeProfile, clock, confirmed, distance, Profile, regionKey, regions, State } from './core';
import { read, update, scopeToken } from './store';
function scopedKey(p:Profile){const scope=scopeToken?.()??'guest';return scope==='guest'?regionKey(p):`${scope}|${regionKey(p)}`;}
export const TASK='graveyard-workplace-v1'; // Keep the existing task name across upgrades.
export const LIMIT=Platform.OS==='ios'?20:Platform.OS==='android'?100:0;
const boundaryQueues=new Map<string,Promise<void>>();
function boundary(id:string,fn:()=>Promise<void>){const previous=boundaryQueues.get(id)??Promise.resolve();const next=previous.then(fn,fn);boundaryQueues.set(id,next);void next.finally(()=>{if(boundaryQueues.get(id)===next)boundaryQueues.delete(id);}).catch(()=>{});return next;}
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
async function notify(direction:'in'|'out',name:string){try{if((await Notifications.getPermissionsAsync()).granted)await Notifications.scheduleNotificationAsync({content:{title:`${name} · ${direction==='in'?'CLOCKED IN':'CLOCKED OUT'}`,body:'Your shift record has been saved on this device.'},trigger:null});}catch{/* Saved shifts do not depend on notification delivery. */}}
TaskManager.defineTask<{eventType:Location.GeofencingEventType;region:Location.LocationRegion}>(TASK,async({data,error})=>{
 if(error){update(s=>({...s,monitorError:error.message}));return;}
 const detected=Date.now();
 if(!data)return;
 const p=read().profiles.find(p=>scopedKey(p)===data.region.identifier&&p.automation&&!p.archived);
 if(!p?.workplace)return; // Deleted, disabled, old-revision and legacy single-location events are ignored.
 const direction=data.eventType===Location.GeofencingEventType.Enter?'in':'out';
 return boundary(p.id,async()=>{try{
  const fix=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High});
  let changed=false;
  update(s=>{
   const current=s.profiles.find(x=>x.id===p.id);
   if(!current?.automation||current.archived||scopedKey(current)!==data.region.identifier)return s;
   if(Date.now()-fix.timestamp>120000||!confirmed(direction,distance(fix.coords,current.workplace!),fix.coords.accuracy??Infinity,current.workplace!.radius))return changeProfile(s,p.id,p=>({...p,diagnostic:'Boundary could not be confirmed accurately. Review this profile’s shift manually.'}));
   const next=clock(s,direction,'auto',detected,`${data.region.identifier}:${direction}`,p.id);changed=next.shifts!==s.shifts;
   return changeProfile(next,p.id,p=>({...p,diagnostic:''}));
  });
  if(changed){await notify(direction,p.name);if((scopeToken?.()??'guest')!=='guest'){try{await (await import('./cloud-sync')).syncCloud();}catch{/* Durable pending changes retry on app resume. */}}}
 }catch(e){update(s=>changeProfile(s,p.id,p=>({...p,diagnostic:`GPS confirmation failed: ${String(e)}. Review this profile’s shift.`})));}});
});

// Serialize all native registrations so profile edits and app-resume checks cannot race.
let queue:Promise<unknown>=Promise.resolve();
function serial<T>(fn:()=>Promise<T>):Promise<T>{const next=queue.then(fn,fn);queue=next.catch(()=>{});return next;}
async function permissions(request:boolean){
 if(Platform.OS==='web'||!await TaskManager.isAvailableAsync())throw Error('GPS automation requires a native development or production build.');
 if(!await Location.hasServicesEnabledAsync())throw Error('Turn on Location Services.');
 if(request&&!(await Location.requestForegroundPermissionsAsync()).granted)throw Error('Foreground location permission denied.');
 const background=request?await Location.requestBackgroundPermissionsAsync():await Location.getBackgroundPermissionsAsync();
 if(!background.granted)throw Error('Allow background location (Always on iPhone) in system settings.');
 if(!await Location.isBackgroundLocationAvailableAsync())throw Error('Background location is unavailable on this device.');
}
async function registeredKeys():Promise<string[]>{
 if(!await Location.hasStartedGeofencingAsync(TASK))return [];
 const options=await TaskManager.getTaskOptionsAsync(TASK) as {regions?:Location.LocationRegion[]}|null;
 return ((options?.regions??[]) as Location.LocationRegion[]).map(r=>r.identifier??'');
}
function same(a:string[],b:string[]){return a.length===b.length&&[...a].sort().every((v,i)=>v===[...b].sort()[i]);}
async function reconcile(request=false){
 try{
  const desired=regions(read(),LIMIT).map(r=>({...r,identifier:(scopeToken?.()??'guest')==='guest'?r.identifier:`${scopeToken()}|${r.identifier}`}));
  if(!desired.length){if(await Location.hasStartedGeofencingAsync(TASK))await Location.stopGeofencingAsync(TASK);update(s=>({...s,monitorError:''}));return;}
  await permissions(request);
  if(!same(await registeredKeys(),desired.map(r=>r.identifier)))await Location.startGeofencingAsync(TASK,desired);
  if(!same(await registeredKeys(),desired.map(r=>r.identifier)))throw Error('Native geofence registration did not match enabled profiles. Retry monitoring.');
  update(s=>({...s,monitorError:''}));
 }catch(e){update(s=>({...s,monitorError:`Monitoring needs attention: ${e instanceof Error?e.message:String(e)}`}));throw e;}
}
export async function sync(){return serial(()=>reconcile(false));}
export async function configure(fn:(s:State)=>State){return serial(async()=>{const candidate=fn(read());regions(candidate,LIMIT);update(()=>candidate);await reconcile(false);});}
export async function start(id=read().selectedId){return serial(async()=>{
 const p=read().profiles.find(p=>p.id===id);if(!p?.workplace||p.archived)throw Error('Assign a location to an unarchived profile first.');
 const candidate=changeProfile(read(),id,p=>({...p,automation:true,lastEvent:'',revision:p.revision+1}));regions(candidate,LIMIT);
 await permissions(true);update(s=>changeProfile(s,id,p=>({...p,automation:true,lastEvent:'',revision:p.revision+1})));
 await reconcile(false);
});}
export async function stop(id=read().selectedId){return configure(s=>changeProfile(s,id,p=>({...p,automation:false,lastEvent:'',revision:p.revision+1})));}
export async function stopAll(){return configure(s=>({...s,profiles:s.profiles.map(p=>({...p,automation:false,lastEvent:'',revision:p.revision+1}))}));}
export type Monitoring={registered:string[];error:string;enabled:number};
export async function monitoring():Promise<Monitoring>{
 const s=read(),enabled=s.profiles.filter(p=>p.automation&&!p.archived).length;
 try{if(!enabled)return {registered:[],error:s.monitorError,enabled};await permissions(false);const keys=await registeredKeys();const desired=regions(s,LIMIT).map(r=>({...r,identifier:(scopeToken?.()??'guest')==='guest'?r.identifier:`${scopeToken()}|${r.identifier}`}));const exact=same(keys,desired.map(r=>r.identifier));return {registered:s.profiles.filter(p=>p.automation&&!p.archived&&keys.includes(scopedKey(p))).map(p=>p.id),error:exact?s.monitorError:'Registration differs from enabled profiles. Retry monitoring.',enabled};}
 catch(e){return {registered:[],error:e instanceof Error?e.message:String(e),enabled};}
}
export function profileStatus(p:Profile,m:Monitoring){return p.archived?'Archived · GPS off':!p.workplace?'Manual only · no location':!p.automation?'Automatic clocking off':m.registered.includes(p.id)?'Geofence registered · OS monitoring':'Not monitoring · needs attention';}

export async function suspendMonitoring(){return serial(async()=>{if(await Location.hasStartedGeofencingAsync(TASK))await Location.stopGeofencingAsync(TASK);});}
