import { changeProfile, clock, confirmed, distance, regionKey, type Profile, type State } from './core';
import { checkFix, gpsDiagnostic, LocationFailure, locationError } from './location-checks';
import { browserLocationReady } from './web-geolocation';
import { read, update, scopeToken } from './store';

export const LIMIT=Infinity;
export type Monitoring={registered:string[];error:string;enabled:number};
let watch:number|null=null,optedIn=false,message='',phase='Paused · enable foreground GPS',scope='',generation=0;
const candidates=new Map<string,{direction:'in'|'out';first:number;last:number;count:number}>();
const verified=new Map<string,{key:string;at:number;status:string;accuracy:number;active:boolean}>();
function pause(reason:string){generation++;if(watch!==null)navigator.geolocation?.clearWatch(watch);watch=null;phase=reason;candidates.clear();verified.clear();}
function begin(){
 if(!optedIn||watch!==null||document.visibilityState!=='visible')return;
 try{browserLocationReady();}catch(e){const failure=e as LocationFailure;message=failure.message;phase=`Unavailable · ${failure.code}`;gpsDiagnostic('watch-preflight-failed',{code:failure.code});return;}
 scope=scopeToken();const ownGeneration=++generation;phase='Waiting for an accurate GPS fix';message='';
 try{watch=navigator.geolocation.watchPosition(fix=>{
  if(ownGeneration!==generation||document.visibilityState!=='visible'||scope!==scopeToken())return;
  try{checkFix(fix,100);}catch(e){const failure=e as LocationFailure;candidates.clear();verified.clear();phase='Waiting · GPS fix rejected';message=failure.message;gpsDiagnostic('watch-fix-rejected',{code:failure.code,accuracyMeters:failure.accuracyMeters});return;}
  message='';phase='Waiting · verifying foreground GPS';
  try{update(s=>{let next=s;
   for(const p of s.profiles.filter(p=>p.automation&&!p.archived&&p.workplace)){
    const w=p.workplace!,d=distance(fix.coords,w),accuracy=fix.coords.accuracy,key=regionKey(p);
    const direction=confirmed('in',d,accuracy,w.radius)?'in':confirmed('out',d,accuracy,w.radius)?'out':null;
    if(!direction){candidates.delete(key);verified.set(p.id,{key,at:fix.timestamp,accuracy,active:false,status:`Waiting · boundary uncertain (±${Math.ceil(accuracy)} m)`});continue;}
    const candidate=candidates.get(key);
    if(!candidate||candidate.direction!==direction||fix.timestamp-candidate.last>30000){candidates.set(key,{direction,first:fix.timestamp,last:fix.timestamp,count:1});verified.set(p.id,{key,at:fix.timestamp,accuracy,active:false,status:'Verifying boundary · waiting for another fresh fix'});continue;}
    if(fix.timestamp<=candidate.last)continue;candidate.last=fix.timestamp;candidate.count++;
    if(candidate.count>=2&&fix.timestamp-candidate.first>=8000){next=clock(next,direction,'auto',candidate.first,`web:${key}:${direction}`,p.id);verified.set(p.id,{key,at:fix.timestamp,accuracy,active:true,status:`Active · foreground GPS (±${Math.ceil(accuracy)} m)`});}
   }
   return next;
  });}catch(e){message='GPS event could not be saved. Check browser storage and retry monitoring.';pause('Unavailable · GPS event could not be saved');gpsDiagnostic('watch-save-failed');}
 },error=>{if(ownGeneration!==generation)return;const failure=locationError(error);message=failure.message;pause(error.code===1?'Permission denied · allow location to resume':`Unavailable · ${failure.code}`);gpsDiagnostic('watch-failed',{code:error.code});},{enableHighAccuracy:true,maximumAge:0,timeout:20000});}
 catch{message='The browser could not start location monitoring. Check site permissions and retry.';pause('Unavailable · location watcher failed');gpsDiagnostic('watch-threw');}
}
if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')pause('Paused · page is hidden');else begin();});
export async function sync(){
 if(watch!==null&&scope!==scopeToken())pause('Paused · account changed');
 if(!read().profiles.some(p=>p.automation&&!p.archived&&p.workplace)){pause('Paused · no enabled locations');return;}
 begin();
}
export async function configure(fn:(s:State)=>State){update(fn);await sync();}
export async function start(id=read().selectedId){
 const p=read().profiles.find(p=>p.id===id);if(!p?.workplace||p.archived)throw Error('Save a location for this profile first.');
 browserLocationReady();optedIn=true;update(s=>changeProfile(s,id,p=>({...p,automation:true})));pause('Waiting for permission');begin();
}
export async function stop(id=read().selectedId){update(s=>changeProfile(s,id,p=>({...p,automation:false,lastEvent:'',revision:p.revision+1})));await sync();}
export async function stopAll(){update(s=>({...s,profiles:s.profiles.map(p=>({...p,automation:false,lastEvent:'',revision:p.revision+1}))}));pause('Paused · GPS disabled');}
export async function suspendMonitoring(){optedIn=false;pause('Paused · account changed');}
export async function monitoring():Promise<Monitoring>{
 const s=read(),enabled=s.profiles.filter(p=>p.automation&&!p.archived).length;
 const registered=watch!==null&&document.visibilityState==='visible'&&scope===scopeToken()?s.profiles.filter(p=>{const v=verified.get(p.id);return p.automation&&!p.archived&&v?.active&&v.key===regionKey(p)&&Date.now()-v.at<30000;}).map(p=>p.id):[];
 return {registered,error:message||s.monitorError,enabled};
}
export function profileStatus(p:Profile,m:Monitoring){
 if(p.archived)return 'Archived · GPS off';if(!p.workplace)return 'Manual only · no location';if(!p.automation)return 'GPS off';
 const v=verified.get(p.id);if(m.registered.includes(p.id)&&v)return v.status;
 if(watch!==null&&scope===scopeToken()&&document.visibilityState==='visible'&&v?.key===regionKey(p))return Date.now()-v.at<30000?(v.active?'Waiting · refresh monitoring status':v.status):'Waiting · no recent verified GPS fix';
 return phase;
}
