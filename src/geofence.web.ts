import { changeProfile, type Profile, type State } from './core';
import { read, update } from './store';

// No TaskManager/Location imports: browsers must never register or claim a background fence.
export const LIMIT=0;
export type Monitoring={registered:string[];error:string;enabled:number};
export async function sync(){/* Native background monitoring is deliberately unavailable. */}
export async function configure(fn:(s:State)=>State){update(fn);}
export async function start(_id=read().selectedId){throw Error('Background GPS clocking is unavailable in browsers. Use the iPhone or Android native build. Manual timers work here.');}
export async function stop(id=read().selectedId){update(s=>changeProfile(s,id,p=>({...p,automation:false,lastEvent:'',revision:p.revision+1})));}
export async function stopAll(){update(s=>({...s,profiles:s.profiles.map(p=>({...p,automation:false,lastEvent:'',revision:p.revision+1}))}));}
export async function monitoring():Promise<Monitoring>{return {registered:[],error:read().monitorError,enabled:0};}
export function profileStatus(p:Profile,_m:Monitoring){return p.archived?'Archived · GPS off':'Manual tracking · background GPS unavailable on web';}
