import React, { useEffect, useState } from 'react';
import { AppState, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from './alerts';
import { accountId, backupList, checkpoint, loadAccount, subscribeStore } from './account-store';
import { type Choices, documentOf, equal, planImport } from './cloud-model';
import { getSyncView, logout, sendCode, subscribeSync, syncCloud, useSession, verifyCode } from './cloud-sync';
import { cloudConfigured, supabase } from './supabase';
import { read, readGuest, update } from './store';
import { exportData, exportRecovery, exportSnapshot } from './export';

function Action({title,onPress,disabled=false}:{title:string;onPress:()=>void;disabled?:boolean}){return <Pressable disabled={disabled} accessibilityRole="button" onPress={onPress} style={[styles.button,{opacity:disabled?.5:1}]}><Text style={styles.action}>{title}</Text></Pressable>;}
export function CloudAccount({onChange}:{onChange:()=>void}){
 const [open,setOpen]=useState(false),[view,setView]=useState(getSyncView),[email,setEmail]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[epoch,setEpoch]=useState(0),[tick,setTick]=useState(0),[preview,setPreview]=useState<ReturnType<typeof planImport>|null>(null),[choices,setChoices]=useState<Choices>({});
 const refresh=()=>{setView({...getSyncView()});setTick(t=>t+1);onChange();};
 const run=async(fn:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);try{await fn();refresh();}catch(e){Alert.alert('Account',e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 useEffect(()=>{
  let alive=true,debounce:ReturnType<typeof setTimeout>|undefined,lastScheduledId:string|null=null,lastGeneration=-1;
  const notify=()=>{if(alive)refresh();};
  const sync=()=>{if(AppState.currentState==='active'||Platform.OS==='web')void syncCloud().then(async()=>{try{await (await import('./geofence')).sync();}catch{/* Native/web monitoring status reports why registration is unavailable. */}});};
  const offSync=subscribeSync(notify),offStore=subscribeStore(()=>{notify();const id=accountId();if(id){const e=loadAccount();if(e.pending&&(id!==lastScheduledId||e.generation!==lastGeneration)){lastScheduledId=id;lastGeneration=e.generation;clearTimeout(debounce);debounce=setTimeout(sync,500);}}});
  let stopAuth=()=>{};
  if(cloudConfigured){const api=supabase();api.auth.getSession().then(({data,error})=>{if(!alive)return;if(error){Alert.alert('Sign-in',error.message);return;}void useSession(data.session);});const {data}=api.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>{if(alive)void useSession(session);},0);});stopAuth=()=>data.subscription.unsubscribe();}
  const interval=setInterval(sync,15000),app=AppState.addEventListener('change',s=>{if(s==='active'){if(cloudConfigured)supabase().auth.startAutoRefresh();sync();}else if(cloudConfigured)supabase().auth.stopAutoRefresh();});
  if(Platform.OS==='web')window.addEventListener('online',sync);
  return()=>{alive=false;stopAuth();offSync();offStore();clearInterval(interval);clearTimeout(debounce);app.remove();if(Platform.OS==='web')window.removeEventListener('online',sync);};
 },[epoch]);
 const id=accountId(),envelope=id?loadAccount():null;
 useEffect(()=>{setPreview(null);setChoices({});},[id]);
 return <>
 <Pressable accessibilityRole="button" accessibilityLabel="Account and cloud sync" onPress={()=>setOpen(true)}><Text style={styles.indicator}>☁ {view.status}{envelope?.pending&&view.status!=='Syncing'?' · pending':''}  ›</Text></Pressable>
 <Modal visible={open} animationType="slide" onRequestClose={()=>setOpen(false)}><SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.title}>One account. Your hours.</Text>
 {!cloudConfigured&&!id?<Text style={styles.caption}>Cloud setup is optional. Add the Supabase public URL and publishable key from the setup guide, then rebuild. Your existing local records stay on this device.</Text>:!id?<>
 <Text style={styles.caption}>Sign in with an email code. Existing local records remain separate until you approve a previewed import. No password is stored.</Text><TextInput accessibilityLabel="Email address" placeholder="Email address" placeholderTextColor="#9a94a6" autoCapitalize="none" keyboardType="email-address" style={styles.input} value={email} onChangeText={setEmail}/><Action disabled={busy} title="Email a sign-in code" onPress={()=>run(async()=>{await sendCode(email);setSent(true);Alert.alert('Check your email','Enter the code from the Supabase email. If you receive only a link, configure the email template using the setup guide.');})}/>
 {sent&&<><TextInput accessibilityLabel="Email sign-in code" placeholder="Code from email" placeholderTextColor="#9a94a6" keyboardType="number-pad" style={styles.input} value={code} onChangeText={setCode}/><Action disabled={busy} title="Verify and sign in" onPress={()=>run(async()=>{const session=await verifyCode(email,code);await useSession(session);setCode('');})}/></>}
 </>:<>
 <Text style={styles.caption}>{view.email||'Signed-in account'} · {view.status}{envelope?.pending?' · changes queued locally':''}</Text>{!!view.message&&<Text style={styles.warning}>{view.message}</Text>}
 <Action disabled={busy} title="Sync now" onPress={()=>run(()=>syncCloud())}/>
 <Text style={styles.caption}>Sync retries while the app is open or resumes. Native GPS events also attempt sync. Offline changes stay with this account on this device until uploaded. No background delivery is guaranteed by the browser.</Text>
 <Action title="Preview import of original local records" disabled={busy} onPress={()=>run(async()=>{await syncCloud();setPreview(planImport(read(),readGuest()));})}/>
 {preview&&<View style={styles.card}><Text style={styles.caption}>Import preview: {preview.profiles} new profiles · {preview.shifts} new shifts · {preview.duplicates} exact duplicates skipped. Original local data stays untouched. {preview.error}</Text><Action disabled={busy||!!preview.error} title="Back up and import these records" onPress={()=>run(async()=>{if(accountId()!==id)throw Error('Account changed. Preview the import again.');const source=readGuest(),plan=planImport(read(),source);if(plan.error)throw Error(plan.error);if(!equal(documentOf(plan.state),documentOf(preview.state)))throw Error('Records changed. Open a new import preview.');checkpoint('migration',{guest:source,account:loadAccount()});await exportSnapshot(source,'graveyard-before-import');if(accountId()!==id)throw Error('Account changed. Original records were not imported.');const confirmedPlan=planImport(read(),readGuest());if(!equal(documentOf(confirmedPlan.state),documentOf(preview.state)))throw Error('Records changed while saving the backup. Preview the import again.');update(()=>confirmedPlan.state);setPreview(null);await syncCloud();})}/></View>}
 {!!envelope?.conflicts.length&&<View style={styles.card}><Text style={styles.title}>Review edits.</Text><Text style={styles.caption}>Sync is paused for these conflicts. Both versions are retained. A local backup is saved before applying your decisions. You can also edit local shifts, then retry sync.</Text>{envelope.conflicts.map(c=><View key={c.key} style={styles.card}><Text style={styles.caption}>{c.key} · {c.reason}</Text><Text style={styles.detail}>This device: {JSON.stringify(c.local??'(deleted)',null,2)}</Text><Text style={styles.detail}>Cloud: {JSON.stringify(c.remote??'(deleted)',null,2)}</Text><Action title={`${choices[c.key]==='local'?'● ':''}Keep this device’s value`} onPress={()=>setChoices({...choices,[c.key]:'local'})}/><Action title={`${choices[c.key]==='remote'?'● ':''}Use cloud value`} onPress={()=>setChoices({...choices,[c.key]:'remote'})}/></View>)}<Action disabled={busy||envelope.conflicts.some(c=>!choices[c.key])} title="Back up and apply decisions" onPress={()=>run(async()=>{await syncCloud(choices);setChoices({});})}/></View>}
 {!!envelope?.recovered.length&&<Text style={styles.caption}>{envelope.recovered.length} concurrent clock-in proposal(s) were combined with an existing active timer. Their original records remain in recovery backups.</Text>}
 <Action title="Download/share recovery backups" disabled={busy} onPress={()=>run(()=>exportRecovery({account:envelope,backups:backupList()}))}/>
 <Action title="Back up current records · JSON" disabled={busy} onPress={()=>run(()=>exportData(true))}/>
 <Action title="Sign out on this device" disabled={busy} onPress={()=>Alert.alert('Sign out?','Pending changes remain in this account’s private local cache. Sign in again on this device to sync them. The original local tracker is restored; other devices stay signed in.',[{text:'Cancel',style:'cancel'},{text:'Sign out',onPress:()=>run(async()=>{await logout();setPreview(null);setChoices({});setEpoch(e=>e+1);})}])}/>
 </>}
 <Text style={styles.caption}>Accounts keep separate local caches. Signing out removes this device’s stored session, not its pending history. Cloud uploads happen only after sign-in; the original local tracker is never uploaded without approval.</Text><Action title="Close" onPress={()=>setOpen(false)}/>
 </ScrollView></SafeAreaView></Modal>
 </>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#0d0b11'},content:{padding:24,gap:16,maxWidth:680,width:'100%',alignSelf:'center'},title:{color:'#f3edf8',fontSize:25,fontWeight:'900'},caption:{color:'#9a94a6',fontSize:12,lineHeight:19},warning:{color:'#edaaaa',fontSize:12,lineHeight:19},indicator:{color:'#b480ff',fontSize:11,paddingVertical:5},input:{backgroundColor:'#18151e',padding:14,borderWidth:1,borderColor:'#3a3045',borderRadius:12,color:'#f3edf8'},button:{backgroundColor:'#241b30',borderWidth:1,borderColor:'#4b365d',borderRadius:12,padding:15},action:{color:'#b480ff',fontWeight:'800',fontSize:13},card:{gap:12,padding:14,borderWidth:1,borderColor:'#3a3045',borderRadius:12},detail:{fontSize:11,color:'#e0d4ed',lineHeight:16}});
