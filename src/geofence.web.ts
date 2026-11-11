import { changeProfile, clock, confirmed, distance, regionKey, type Profile, type State } from './core';
import { read, update, scopeToken } from './store';

export const LIMIT=Infinity;
export type Monitoring={registered:string[];error:string;enabled:number};
let watch:number|null=null,optedIn=false,lastFix=0,message='',phase='Paused · enable foreground GPS',scope='';
let generation=0;
const candidates=new Map<string,{direction:'in'|'out';first:number;count:number}>();
function pause(reason:string){generation++;if(watch!==null)navigator.geolocation?.clearWatch(watch);watch=null;lastFix=0;phase=reason;candidates.clear();}
function begin(){
 if(!optedIn||watch!==null||document.visibilityState!=='visible')return;
 if(!window.isSecureContext||!navigator.geolocation){phase='Unavailable · GPS needs HTTPS and browser support';return;}
 scope=scopeToken();const ownGeneration=++generation;phase='Waiting for an accurate GPS fix';
 watch=navigator.geolocation.watchPosition(fix=>{
  if(ownGeneration!==generation||document.visibilityState!=='visible'||scope!==scopeToken())return;
  const now=Date.now();if(now-fix.timestamp>30000||fix.timestamp>now+60000)return;
  lastFix=now;phase='Active · foreground GPS';message='';
  try{update(s=>{let next=s;
   for(const p of s.profiles.filter(p=>p.automation&&!p.archived&&p.workplace)){
    const w=p.workplace!,d=distance(fix.coords,w),accuracy=fix.coords.accuracy;
    const direction=confirmed('in',d,accuracy,w.radius)?'in':confirmed('out',d,accuracy,w.radius)?'out':null;
    const key=regionKey(p);if(!direction){candidates.delete(key);phase='Waiting · GPS accuracy/boundary uncertain';continue;}
    const candidate=candidates.get(key);
    if(!candidate||candidate.direction!==direction){candidates.set(key,{direction,first:fix.timestamp,count:1});continue;}
    if(fix.timestamp<=candidate.first)continue;candidate.count++;
    if(candidate.count>=2&&fix.timestamp-candidate.first>=8000)next=clock(next,direction,'auto',candidate.first,`web:${key}:${direction}`,p.id);
   }
   return next;
  });}catch(e){message=e instanceof Error?e.message:String(e);pause('Unavailable · GPS event could not be saved');}
 },error=>{if(ownGeneration!==generation)return;message=error.message;pause(error.code===1?'Permission denied · allow location to resume':'Unavailable · GPS fix failed');},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
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
 if(!window.isSecureContext||!navigator.geolocation)throw Error('Foreground GPS needs HTTPS and a supported browser.');
 optedIn=true;update(s=>changeProfile(s,id,p=>({...p,automation:true})));pause('Waiting for permission');begin();
}
export async function stop(id=read().selectedId){update(s=>changeProfile(s,id,p=>({...p,automation:false,lastEvent:'',revision:p.revision+1})));await sync();}
export async function stopAll(){update(s=>({...s,profiles:s.profiles.map(p=>({...p,automation:false,lastEvent:'',revision:p.revision+1}))}));pause('Paused · GPS disabled');}
export async function suspendMonitoring(){optedIn=false;pause('Paused · account changed');}
export async function monitoring():Promise<Monitoring>{
 const s=read(),enabled=s.profiles.filter(p=>p.automation&&!p.archived).length;
 if(watch!==null&&lastFix>0&&Date.now()-lastFix>=60000)phase='Waiting · no recent GPS fix';
 const active=watch!==null&&document.visibilityState==='visible'&&Date.now()-lastFix<60000&&phase==='Active · foreground GPS';
 return {registered:active?s.profiles.filter(p=>p.automation&&!p.archived&&p.workplace).map(p=>p.id):[],error:message||s.monitorError,enabled};
}
export function profileStatus(p:Profile,m:Monitoring){return p.archived?'Archived · GPS off':!p.workplace?'Manual only · no location':!p.automation?'GPS off':m.registered.includes(p.id)?'Active · foreground GPS':phase;}
