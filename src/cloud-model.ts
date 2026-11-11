import { initialState, type Profile, type Shift, type State, validateState } from './core';

export type Recovery={id:string;reason:string;shift:Shift};
export type Document={state:State;recovered:Recovery[]};
export type Conflict={key:string;reason:string;local:unknown;remote:unknown};
export type Choices=Record<string,'local'|'remote'>;
export const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function portable(state:State):State {
 const profiles=state.profiles.map(p=>({...p,lastEvent:'',diagnostic:'',revision:0})).sort((a,b)=>a.id.localeCompare(b.id));
 return {...state,profiles,shifts:[...state.shifts].sort((a,b)=>a.id.localeCompare(b.id)),selectedId:profiles.find(p=>!p.archived)!.id,monitorError:''};
}
export const documentOf=(state:State,recovered:Recovery[]=[]):Document=>({state:portable(state),recovered});
export function merge(base:Document|null,local:Document,remote:Document,choices:Choices={}):{document:Document;conflicts:Conflict[]}{
 const conflicts:Conflict[]=[];
 function pick(key:string,b:unknown,l:unknown,r:unknown):any {
  if(equal(l,r)||equal(r,b))return l;
  if(equal(l,b))return r;
  if(choices[key])return choices[key]==='local'?l:r;
  conflicts.push({key,reason:'Both devices changed this value, or an edit conflicts with deletion.',local:l,remote:r});return l;
 }
 function records<T extends {id:string}>(kind:'profiles'|'shifts'):T[]{
  const b=new Map((base?.state[kind]??[]).map(x=>[x.id,x])),l=new Map(local.state[kind].map(x=>[x.id,x])),r=new Map(remote.state[kind].map(x=>[x.id,x]));
  const result:T[]=[];
  for(const id of new Set([...b.keys(),...l.keys(),...r.keys()])){
   const bv=b.get(id),lv=l.get(id),rv=r.get(id);let value:any;
   if(lv&&rv&&bv){value={...lv};for(const field of new Set([...Object.keys(lv),...Object.keys(rv)]))value[field]=pick(`${kind}:${id}:${field}`,(bv as any)[field],(lv as any)[field],(rv as any)[field]);}
   else value=pick(`${kind}:${id}`,bv,lv,rv);
   if(value)result.push(value);
  }
  return result;
 }
 const profiles=records<Profile>('profiles');let shifts=records<Shift>('shifts');
 const recovered=[...new Map([...remote.recovered,...local.recovered].map(x=>[x.id,x])).values()];
 // Concurrent starts represent one ongoing session. Keep the earliest stable record,
 // and preserve every suppressed proposal for backup/review rather than discard it.
 for(const p of profiles){
  const active=shifts.filter(s=>s.profileId===p.id&&s.end===null).sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
  if(active.length>1){for(const duplicate of active.slice(1)){if(!recovered.some(r=>r.id===duplicate.id))recovered.push({id:duplicate.id,reason:`Concurrent start combined with ${active[0].id}`,shift:duplicate});shifts=shifts.filter(s=>s.id!==duplicate.id);}}
 }
 let state:State={...local.state,profiles,shifts,selectedId:profiles.find(p=>!p.archived)?.id??'',monitorError:''};
 try{validateState(state);}catch{
  // Cross-record conflicts (e.g. overlapping corrections or deleting a profile
  // while another device adds a shift) require an explicit snapshot decision.
  const key='schedule';const selected=choices[key];
  if(selected)state=selected==='local'?local.state:remote.state;
  else {conflicts.push({key,reason:'The combined records overlap or a profile was deleted while another device used it. Choose a version after reviewing both backups.',local:local.state,remote:remote.state});state=local.state;}
 }
 return {document:{state:portable(state),recovered},conflicts};
}
export function applyRemote(current:State,next:State):State {
 const profiles=next.profiles.map(p=>{const old=current.profiles.find(x=>x.id===p.id);const changed=!old||!equal(old.workplace,p.workplace)||old.automation!==p.automation||old.archived!==p.archived;
  return {...p,lastEvent:changed?'':old!.lastEvent,diagnostic:changed?'':old!.diagnostic,revision:(old?.revision??0)+(changed?1:0)};
 });
 const selectedId=profiles.some(p=>p.id===current.selectedId&&!p.archived)?current.selectedId:profiles.find(p=>!p.archived)!.id;
 const state={...next,profiles,selectedId,monitorError:current.monitorError};validateState(state);return state;
}
function hash(text:string){let h=2166136261;for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
export function planImport(target:State,source:State){
 const next=JSON.parse(JSON.stringify(target)) as State,ids=new Map<string,string>();let profiles=0,shifts=0,duplicates=0;
 for(const p of source.profiles){const same=next.profiles.find(x=>equal({...x,id:'',lastEvent:'',diagnostic:'',revision:0},{...p,id:'',lastEvent:'',diagnostic:'',revision:0}));if(same){ids.set(p.id,same.id);continue;}
  let id=p.id;if(next.profiles.some(x=>x.id===id))id=`import-${id}-${hash(JSON.stringify(p))}`;
  if(!next.profiles.some(x=>x.id===id)){next.profiles.push({...p,id,automation:false,lastEvent:'',diagnostic:'Imported. Enable monitoring when ready.',revision:p.revision+1});profiles++;}ids.set(p.id,id);
 }
 for(const s of source.shifts){const item={...s,profileId:ids.get(s.profileId)!};
  if(next.shifts.some(x=>equal(x,item)||(x.profileId===item.profileId&&x.start===item.start&&x.end===item.end&&x.workplace===item.workplace))){duplicates++;continue;}
  if(next.shifts.some(x=>x.id===item.id))item.id=`import-${item.id}-${hash(JSON.stringify(item))}`;
  next.shifts.push(item);shifts++;
 }
 let error='';try{validateState(next);}catch(e){error=e instanceof Error?e.message:String(e);}
 return {state:next,profiles,shifts,duplicates,error};
}
export const emptyDocument=():Document=>documentOf(initialState());
