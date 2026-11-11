import { initialState, type State, validateState } from './core';
import { applyRemote, type Choices, type Conflict, type Document, documentOf, emptyDocument, equal, type Recovery } from './cloud-model';
import { kv } from './kv';
export type Envelope={state:State;base:Document|null;revision:number;generation:number;pending:boolean;recovered:Recovery[];conflicts:Conflict[];conflictRemote?:Document;conflictGeneration?:number};
const listeners=new Set<()=>void>();
export const changed=()=>listeners.forEach(fn=>fn());
export function subscribeStore(fn:()=>void){listeners.add(fn);return ()=>listeners.delete(fn);}
export const accountId=()=>kv.get('active-account');
export const scopeToken=()=>accountId()??'guest';
export function activateAccount(id:string|null){if(id)kv.set('active-account',id);else kv.remove('active-account');changed();}
export function loadAccount(id=accountId()):Envelope {if(!id)throw Error('Sign in first.');const raw=kv.get(`account:${id}`);return raw?JSON.parse(raw):{state:initialState(),base:emptyDocument(),revision:0,generation:0,pending:false,recovered:[],conflicts:[]};}
export function saveAccount(envelope:Envelope,id=accountId()){if(!id)throw Error('No account selected.');validateState(envelope.state);kv.set(`account:${id}`,JSON.stringify(envelope));changed();}
export function readAccount(){return loadAccount().state;}
export function updateAccount(fn:(s:State)=>State){return kv.transaction(()=>{const e=loadAccount(),next=fn(e.state);validateState(next);const dirty=!equal(documentOf(e.state,e.recovered),documentOf(next,e.recovered));saveAccount({...e,state:next,generation:e.generation+(dirty?1:0),pending:e.pending||dirty});return next;});}
export function checkpoint(reason:string,payload:unknown,id=accountId()){
 const key=`backup:${id??'guest'}:${reason}:${Date.now()}-${Math.random().toString(36).slice(2)}`;
 // Backup must persist successfully before any migration/conflict application proceeds.
 kv.set(key,JSON.stringify({version:1,createdAt:Date.now(),reason,payload}));
 const indexKey=`backups:${id??'guest'}`,index:string[]=JSON.parse(kv.get(indexKey)??'[]');
 if(!index.includes(key))index.push(key);
 const obsolete=reason==='before-cloud-merge'?index.filter(k=>k!==key&&k.includes(':before-cloud-merge:')):[];
 kv.set(indexKey,JSON.stringify(index.filter(k=>!obsolete.includes(k))));obsolete.forEach(k=>kv.remove(k));return key;
}
export function backupList(){return (JSON.parse(kv.get(`backups:${accountId()??'guest'}`)??'[]') as string[]).map(key=>({key,data:JSON.parse(kv.get(key)!)}));}
export function adopt(document:Document,revision:number,expectedGeneration:number){const e=loadAccount();if(e.generation!==expectedGeneration)throw Error('Local records changed during sync. Retrying safely.');checkpoint('before-cloud-merge',{local:e,remote:document});saveAccount({...e,state:applyRemote(e.state,document.state),base:document,revision,pending:false,conflicts:[],conflictRemote:undefined,recovered:document.recovered});}
