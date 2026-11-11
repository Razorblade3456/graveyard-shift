import type { Session } from '@supabase/supabase-js';
import { accountId, activateAccount, adopt, changed, checkpoint, loadAccount, saveAccount } from './account-store';
import { applyRemote, type Choices, type Document, documentOf, emptyDocument, equal, merge } from './cloud-model';
import { cloudConfigured, forgetSession, supabase } from './supabase';
import { validateState } from './core';
export type SyncStatus='Synced'|'Syncing'|'Offline'|'Sync Error'|'Local only';
let view:{status:SyncStatus;message:string;email:string}={status:'Local only',message:'',email:''};
const listeners=new Set<()=>void>();let flight:Promise<void>|null=null;
export const getSyncView=()=>view;
export function subscribeSync(fn:()=>void){listeners.add(fn);return ()=>listeners.delete(fn);}
function report(status:SyncStatus,message=''){view={...view,status,message};listeners.forEach(fn=>fn());}
function offline(){return typeof navigator!=='undefined'&&'onLine' in navigator&&navigator.onLine===false;}
function valid(document:Document){validateState(document.state);if(!Array.isArray(document.recovered))throw Error('Invalid cloud backup data.');}
async function timed<T>(operation:(signal:AbortSignal)=>PromiseLike<T>):Promise<T>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{return await operation(controller.signal);}finally{clearTimeout(timer);}}
export async function syncCloud(choices:Choices={}):Promise<void>{
 if(flight)return flight;
 flight=perform(choices).finally(()=>{flight=null;});return flight;
}
async function perform(choices:Choices){
 const id=accountId();if(!id||!cloudConfigured){report('Local only');return;}
 if(offline()){report('Offline','Changes are saved locally and will retry when online.');return;}
 report('Syncing');
 try{
  const api=supabase(),session=await api.auth.getSession();if(session.error)throw session.error;
  if(session.data.session?.user.id!==id)throw Error('Sign in again to sync this account. Local records remain on this device.');
  for(let attempt=0;attempt<4;attempt++){
   const {data,error}=await timed(signal=>api.from('gs_workspaces').select('revision,document').eq('user_id',id).abortSignal(signal).maybeSingle());if(error)throw error;
   if(accountId()!==id)return;
   const remote:Document=data?.document??emptyDocument();valid(remote);
   const revision=Number(data?.revision??0);let e=loadAccount(id);const local=documentOf(e.state,e.recovered);
   if(Object.keys(choices).length&&e.conflictGeneration!==undefined&&e.conflictGeneration!==e.generation)throw Error('Records changed since the conflict preview. Sync again before choosing a version.');
   if(Object.keys(choices).length&&!equal(e.conflictRemote,remote))throw Error('Cloud records changed since the preview. Sync again before choosing a version.');
   // A missing/reset backend is never evidence that this device's history should be erased.
   if(!data?.document&&!equal(local,emptyDocument())){e={...e,base:emptyDocument(),pending:true};saveAccount(e,id);}
   if(data?.document&&remote.state.shifts.length===0&&local.state.shifts.length>0&&(e.base?.state.shifts.length??0)>0){
    if(choices['empty-cloud']==='remote'){checkpoint('before-conflict-resolution',{local:e,remote},id);adopt(remote,revision,e.generation);report('Synced');return;}
    if(choices['empty-cloud']==='local'){checkpoint('before-conflict-resolution',{local:e,remote},id);e={...e,base:remote,pending:true};}
    else {saveAccount({...e,pending:true,conflicts:[{key:'empty-cloud',reason:'Cloud history is empty. Existing local records were preserved. Explicitly choose whether to restore this device’s history or accept the empty cloud version.',local,remote}],conflictRemote:remote,conflictGeneration:e.generation},id);report('Sync Error','Cloud history is empty. Review before replacing local records.');return;}
   }
   if(!e.pending){if(!equal(local,remote)||!e.base)adopt(remote,revision,e.generation);report('Synced');return;}
   const result=merge(e.base,local,remote,choices);
   if(result.conflicts.length){saveAccount({...e,conflicts:result.conflicts,conflictRemote:remote,conflictGeneration:e.generation},id);report('Sync Error','Conflicting edits need review in Account. Both copies are retained.');return;}
   if(equal(result.document,remote)){adopt(remote,revision,e.generation);report('Synced');return;}
   if(Object.keys(choices).length)checkpoint('before-conflict-resolution',{local:e,remote},id);
   const {data:reply,error:writeError}=await timed(signal=>api.rpc('gs_compare_and_swap',{p_expected_revision:revision,p_document:result.document}).abortSignal(signal));if(writeError)throw writeError;
   if(accountId()!==id)return;
   if(!reply.applied)continue;
   // A manual edit or GPS event may have arrived while the upload was in flight.
   const latest=loadAccount(id),rebased=merge(local,documentOf(latest.state,latest.recovered),result.document);
   checkpoint('before-cloud-merge',{local:latest,remote:result.document},id);
   if(rebased.conflicts.length){saveAccount({...latest,base:result.document,revision:Number(reply.revision),pending:true,conflicts:rebased.conflicts,conflictRemote:result.document,conflictGeneration:latest.generation},id);report('Sync Error','An edit arrived during sync. Review both versions in Account.');return;}
   saveAccount({...latest,state:applyRemote(latest.state,rebased.document.state),base:result.document,revision:Number(reply.revision),recovered:rebased.document.recovered,pending:!equal(rebased.document,result.document),conflicts:[],conflictRemote:undefined},id);
   if(loadAccount(id).pending)continue;
   report('Synced');return;
  }
  throw Error('Other devices are updating this account. Changes remain queued; retry shortly.');
 }catch(e){const message=e instanceof Error?e.message:String(e);report(offline()||/network|failed to fetch|fetch failed|aborted|timeout/i.test(message)?'Offline':'Sync Error',message);}
}
export async function sendCode(email:string){const {error}=await supabase().auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:true}});if(error)throw error;}
export async function verifyCode(email:string,token:string){const {data,error}=await supabase().auth.verifyOtp({email:email.trim(),token:token.trim(),type:'email'});if(error)throw error;return data.session;}
let switching=Promise.resolve(),sessionEpoch=0;
export function useSession(session:Session|null){const ticket=++sessionEpoch;switching=switching.then(async()=>{if(ticket!==sessionEpoch)return;const id=session?.user.id??null;if(accountId()!==id){const { suspendMonitoring }=await import('./geofence');await suspendMonitoring();if(ticket!==sessionEpoch)return;activateAccount(id);}
 view={...view,email:session?.user.email??''};changed();if(id){await syncCloud();if(accountId()===id){try{await (await import('./geofence')).sync();}catch{/* Monitoring status explains native permission/limit failures. */}}}else report('Local only');}).catch(e=>report('Sync Error',String(e)));return switching;}
export async function logout(){
 sessionEpoch++;
 const id=accountId();if(id)checkpoint('before-logout',loadAccount(id),id);
 const {suspendMonitoring}=await import('./geofence');await suspendMonitoring();
 // Local sign-out must work offline; pending records remain in this user's isolated cache.
 await forgetSession();
 activateAccount(null);view={status:'Local only',message:'',email:''};listeners.forEach(fn=>fn());try{await (await import('./geofence')).sync();}catch{/* Local monitoring status explains permission or limit failures. */}
}
