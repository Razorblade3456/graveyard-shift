import 'react-native-url-polyfill/auto';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { authStorage } from './auth-storage';
const url=process.env.EXPO_PUBLIC_SUPABASE_URL;
const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfigured=!!url&&!!key;
let client:SupabaseClient|null=null;
let epoch=0,writes:Promise<unknown>=Promise.resolve();
const timedFetch:typeof fetch=async(input,init)=>{const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,15000);init?.signal?.addEventListener('abort',abort);try{return await fetch(input,{...init,signal:controller.signal});}finally{clearTimeout(timer);init?.signal?.removeEventListener('abort',abort);}};
export function supabase(){
 if(!cloudConfigured)throw Error('Cloud sync is not configured. Add the public Supabase URL and publishable key, then rebuild. Local tracking still works.');
 if(!client){const ownEpoch=epoch;const storage={getItem:(name:string)=>ownEpoch===epoch?authStorage.getItem(name):Promise.resolve(null),setItem:(name:string,value:string)=>{const next=writes.then(()=>ownEpoch===epoch?authStorage.setItem(name,value):undefined);writes=next.catch(()=>{});return next;},removeItem:(name:string)=>{const next=writes.then(()=>ownEpoch===epoch?authStorage.removeItem(name):undefined);writes=next.catch(()=>{});return next;}};client=createClient(url!,key!,{global:{fetch:timedFetch},auth:{storage,lock:Platform.OS==='web'?undefined:processLock,storageKey:'graveyard-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});}
 return client;
}
export async function forgetSession(){epoch++;client?.auth.stopAutoRefresh();await writes;await authStorage.removeItem('graveyard-auth');client=null;}
