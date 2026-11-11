export type Shift = { id:string; profileId:string; start:number; end:number|null; workplace:string; startSource:'manual'|'auto'; endSource:'manual'|'auto'|null; edited:boolean };
export type Workplace = { name:string; latitude:number; longitude:number; radius:number };
export const categories = ['Work','Personal','Fitness','Study','Custom'] as const;
export type Profile = { id:string; name:string; color:string; icon:string; category:typeof categories[number]; workplace:Workplace|null; automation:boolean; pay:number; archived:boolean; lastEvent:string; diagnostic:string; revision:number };
export type State = { version:2; profiles:Profile[]; selectedId:string; shifts:Shift[]; monitorError:string };
export function newProfile(name='Work',id=`profile-${Date.now()}-${Math.random().toString(36).slice(2)}`):Profile {return {id,name,color:'#b480ff',icon:'✦',category:'Work',workplace:null,automation:false,pay:0,archived:false,lastEvent:'',diagnostic:'',revision:0};}
export const initialState = ():State => ({version:2,profiles:[newProfile('Work','default')],selectedId:'default',shifts:[],monitorError:''});
export function migrate(raw:any):State {
 if(raw?.version===2)return raw;
 if(!raw||!Array.isArray(raw.shifts))throw Error('Invalid saved records.');
 const p={...newProfile(raw.workplace?.name||'Work','default'),workplace:raw.workplace??null,automation:!!raw.automation,pay:Number.isFinite(raw.pay)&&raw.pay>=0?raw.pay:0,diagnostic:raw.diagnostic||''};
 return {version:2,profiles:[p],selectedId:p.id,shifts:raw.shifts.map((s:Shift)=>({...s,profileId:p.id})),monitorError:''};
}
export function validate(shifts:Shift[]) {
 const ids=new Set<string>(),last=new Map<string,Shift>();
 for(const s of [...shifts].sort((a,b)=>a.start-b.start)){
  if(!s.id||typeof s.id!=='string'||ids.has(s.id)||typeof s.profileId!=='string'||!s.profileId||!Number.isFinite(s.start)||s.start<0||(s.end!==null&&(!Number.isFinite(s.end)||s.end<=s.start)))throw Error('Each shift needs a unique ID, profile, and end after its start.');
  ids.add(s.id);
  if(s.start>Date.now()+60000||(s.end!==null&&s.end>Date.now()+60000))throw Error('Shifts cannot be in the future.');
  const previous=last.get(s.profileId);if(previous&&(previous.end??Infinity)>s.start)throw Error('Shifts in the same profile cannot overlap. Correct the earlier shift first.');
  if(!['manual','auto'].includes(s.startSource)||!['manual','auto',null].includes(s.endSource)||typeof s.edited!=='boolean'||typeof s.workplace!=='string'||(s.end===null)!==(s.endSource===null))throw Error('Invalid shift metadata.');
  last.set(s.profileId,s);
 }
}
export function validateState(s:State){
 if(s.version!==2||!Array.isArray(s.profiles)||!s.profiles.length||!Array.isArray(s.shifts))throw Error('Invalid profile backup.');
 const ids=new Set<string>();for(const p of s.profiles){
  if(typeof p.id!=='string'||!p.id||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||!/^#[a-f\d]{6}$/i.test(p.color)||typeof p.icon!=='string'||!p.icon.trim()||p.icon.length>16||!categories.includes(p.category)||!Number.isFinite(p.pay)||p.pay<0||typeof p.archived!=='boolean'||typeof p.automation!=='boolean'||typeof p.lastEvent!=='string'||typeof p.diagnostic!=='string'||!Number.isInteger(p.revision)||p.revision<0)throw Error('Invalid profile settings.');
  ids.add(p.id);const w=p.workplace;
  if(w!==null&&(!w||typeof w.name!=='string'||!Number.isFinite(w.latitude)||Math.abs(w.latitude)>90||!Number.isFinite(w.longitude)||Math.abs(w.longitude)>180||!Number.isFinite(w.radius)||w.radius<100||w.radius>1000))throw Error('Invalid profile location.');
  if(p.automation&&(!w||p.archived))throw Error('Archived or location-free profiles cannot enable GPS.');
 }
 validate(s.shifts);if(!ids.has(s.selectedId)||s.profiles.find(p=>p.id===s.selectedId)?.archived)throw Error('Select an unarchived profile.');
 if(s.shifts.some(x=>!ids.has(x.profileId)))throw Error('Shift refers to a missing profile.');
 if(s.profiles.some(p=>p.archived&&s.shifts.some(x=>x.profileId===p.id&&x.end===null)))throw Error('Clock out before archiving a profile.');
}
export function changeProfile(state:State,id:string,fn:(p:Profile)=>Profile):State {return {...state,profiles:state.profiles.map(p=>p.id===id?fn(p):p)};}
export function decodeBackup(raw:string):State {
 const value=JSON.parse(raw);if(![1,2].includes(value.version)||!Array.isArray(value.state?.shifts))throw Error('Not a Graveyard Shift backup.');
 const state=migrate(value.state);validateState(state);
 return {...state,monitorError:'',profiles:state.profiles.map(p=>({...p,automation:false,lastEvent:'',diagnostic:'Backup restored. Enable GPS when ready.',revision:p.revision+1}))};
}
export function removeProfile(state:State,id:string):State {
 if(state.shifts.some(s=>s.profileId===id&&s.end===null))throw Error('Clock out of this profile before deleting it.');
 const profiles=state.profiles.filter(p=>p.id!==id),fallback=profiles.find(p=>!p.archived);
 if(!fallback)throw Error('Keep at least one unarchived profile. Create or restore another first.');
 return {...state,profiles,shifts:state.shifts.filter(s=>s.profileId!==id),selectedId:state.selectedId===id?fallback.id:state.selectedId};
}
export function archiveProfile(state:State,id:string):State {
 if(state.shifts.some(s=>s.profileId===id&&s.end===null))throw Error('Clock out of this profile before archiving it.');
 const p=state.profiles.find(p=>p.id===id);if(!p)throw Error('Profile no longer exists.');
 const next=changeProfile(state,id,p=>({...p,archived:!p.archived,automation:false,lastEvent:'',revision:p.revision+1}));
 if(next.profiles.find(p=>p.id===state.selectedId)?.archived){const fallback=next.profiles.find(p=>!p.archived);if(!fallback)throw Error('Keep at least one unarchived profile.');next.selectedId=fallback.id;}
 return next;
}
export function clock(state:State,direction:'in'|'out',source:'manual'|'auto',at=Date.now(),event='',profileId=state.selectedId):State {
 const p=state.profiles.find(p=>p.id===profileId);if(!p||p.archived)return state;
 if(source==='auto'&&(!p.automation||event===p.lastEvent))return state;
 const active=state.shifts.find(s=>s.profileId===profileId&&s.end===null);
 const next=source==='auto'?changeProfile(state,profileId,p=>({...p,lastEvent:event})):state;
 if((direction==='in'&&active)||(direction==='out'&&!active))return next;
 const shifts=direction==='in'?[...state.shifts,{id:`${at}-${Math.random().toString(36).slice(2)}`,profileId,start:at,end:null,workplace:p.workplace?.name??p.name,startSource:source,endSource:null,edited:false} as Shift]:state.shifts.map(s=>s.id===active!.id?{...s,end:at,endSource:source}:s);
 validate(shifts);return {...next,shifts};
}
export const profileShifts=(state:State,id:string|'all')=>id==='all'?state.shifts:state.shifts.filter(s=>s.profileId===id);
export function hours(shifts:Shift[],from:number,to:number,now=Date.now()){return shifts.reduce((sum,s)=>sum+Math.max(0,Math.min(s.end??now,to)-Math.max(s.start,from)),0)/3600000;}
export function earnings(state:State,from:number,to:number,profileId='all',now=Date.now()){return state.profiles.filter(p=>profileId==='all'||p.id===profileId).reduce((sum,p)=>sum+hours(profileShifts(state,p.id),from,to,now)*p.pay,0);}
export function bounds(date=new Date()){const day=new Date(date.getFullYear(),date.getMonth(),date.getDate());const week=new Date(day);week.setDate(day.getDate()-((day.getDay()+6)%7));return {day:+day,week:+week,month:+new Date(date.getFullYear(),date.getMonth(),1)};}
export function distance(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}){const r=Math.PI/180,dLat=(b.latitude-a.latitude)*r,dLon=(b.longitude-a.longitude)*r,h=Math.sin(dLat/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(dLon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
export function confirmed(direction:'in'|'out',d:number,accuracy:number,radius:number){return accuracy>=0&&accuracy<=Math.min(100,radius/2)&&(direction==='in'?d+accuracy<=radius:d-accuracy>=radius+Math.max(30,radius*.15));}
export function regionKey(p:Profile){const w=p.workplace;return w?`${p.id}:${p.revision}:${w.latitude}:${w.longitude}:${w.radius}`:'';}
export function regions(state:State,limit:number){const enabled=state.profiles.filter(p=>p.automation&&!p.archived);if(enabled.length>limit)throw Error(`This device supports ${limit} geofences. ${enabled.length} are enabled. Turn off another profile first; no locations were silently dropped.`);return enabled.map(p=>{if(!p.workplace)throw Error(`${p.name} needs a location.`);return {identifier:regionKey(p),latitude:p.workplace.latitude,longitude:p.workplace.longitude,radius:p.workplace.radius,notifyOnEnter:true,notifyOnExit:true};});}
export function csv(shifts:Shift[],profiles:Profile[]=[]){const quote=(s:unknown)=>'"'+String(s??'').replace(/"/g,'""')+'"';return '\uFEFF'+[['Profile ID','Profile','Category','Workplace','Clock in (ISO)','Clock out (ISO)','Hours','In source','Out source','Edited'],...shifts.map(s=>{const p=profiles.find(p=>p.id===s.profileId);return [s.profileId,p?.name??s.profileId,p?.category??'',s.workplace,new Date(s.start).toISOString(),s.end===null?'':new Date(s.end).toISOString(),s.end===null?'':((s.end-s.start)/3600000).toFixed(4),s.startSource,s.endSource,s.edited];})].map(row=>row.map(quote).join(',')).join('\r\n');}
