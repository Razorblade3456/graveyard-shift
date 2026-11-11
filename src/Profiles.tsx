import React, { useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { archiveProfile, bounds, categories, changeProfile, clock, hours, newProfile, Profile, profileShifts, removeProfile, State } from './core';
import { configure, LIMIT, Monitoring, profileStatus } from './geofence';
import { update } from './store';

type Props={state:State;now:number;health:Monitoring;busy:boolean;run:(fn:()=>unknown|Promise<unknown>)=>Promise<void>;onSelect:(id:string)=>void;onSettings:(id:string)=>void};
const colors=['#b480ff','#db6085','#ed7272','#70baa6','#7ca7e8','#d6b678'];
const duration=(h:number)=>`${Math.floor(h)}h ${Math.floor(h*60)%60}m`;
function Action({title,onPress,color='#b480ff',disabled=false}:{title:string;onPress:()=>void;color?:string;disabled?:boolean}){return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({pressed})=>[styles.action,{borderColor:color,opacity:disabled?.4:pressed?.6:1}]}><Text style={{color,fontWeight:'700',fontSize:12}}>{title}</Text></Pressable>;}
export function ProfilesScreen({state,now,health,busy,run,onSelect,onSettings}:Props){
 const [draft,setDraft]=useState<Profile|null>(null),[rate,setRate]=useState(''),[showArchived,setShowArchived]=useState(false);
 const b=bounds(new Date(now));
 const edit=(p:Profile)=>{setDraft({...p});setRate(p.pay?String(p.pay):'');};
 const save=()=>run(()=>{
  if(!draft)return;const pay=rate.trim()===''?0:Number(rate);if(!Number.isFinite(pay)||pay<0)throw Error('Enter a non-negative hourly rate or leave it blank.');
  const identity={name:draft.name.trim(),color:draft.color,icon:draft.icon.trim(),category:draft.category,pay};
  update(s=>s.profiles.some(p=>p.id===draft.id)?changeProfile(s,draft.id,p=>({...p,...identity})):{...s,profiles:[...s.profiles,{...draft,...identity}],selectedId:draft.id});
  setDraft(null);
 });
 const archive=(p:Profile)=>Alert.alert(p.archived?'Restore profile?':'Archive profile?',p.archived?'History is retained. GPS stays off until you enable it again.':'History will be retained and GPS disabled. Close any active shift first.',[{text:'Cancel',style:'cancel'},{text:p.archived?'Restore':'Archive',onPress:()=>run(()=>configure(s=>archiveProfile(s,p.id)))}]);
 const destroy=(p:Profile)=>{const count=state.shifts.filter(s=>s.profileId===p.id).length;Alert.alert(`Delete ${p.name}?`,`This permanently deletes this profile and ${count} recorded shift(s), including its history. Export a backup first. Close any active shift before deleting.`,[{text:'Cancel',style:'cancel'},{text:'Delete profile and history',style:'destructive',onPress:()=>run(()=>configure(s=>removeProfile(s,p.id)))}]);};
 return <>
 <Text style={styles.caption}>Separate trackers. One device. No accounts. Tap a profile to make it your Home tracker; other timers and GPS fences keep running.</Text>
 <Action title="+ New profile" onPress={()=>edit(newProfile('New profile'))} disabled={busy}/>
 <Text style={styles.caption}>{health.registered.length} verified GPS registrations · {health.enabled}/{LIMIT} enabled. Manual-only profiles are unlimited.</Text>
 {!!health.error&&<Text style={styles.warning}>{health.error}</Text>}
 <Action title={showArchived?'Hide archived profiles':'Show archived profiles'} onPress={()=>setShowArchived(!showArchived)}/>
 {state.profiles.filter(p=>showArchived||!p.archived).map(p=>{
  const shifts=profileShifts(state,p.id),active=shifts.find(s=>s.end===null);
  return <View key={p.id} style={[styles.card,{borderColor:p.color+'77',opacity:p.archived?.7:1}]}>
   <Pressable accessibilityRole="button" disabled={p.archived} onPress={()=>onSelect(p.id)} style={styles.row}>
    <View style={[styles.badge,{backgroundColor:p.color+'22'}]}><Text style={{color:p.color,fontSize:28}}>{p.icon}</Text></View>
    <View style={{flex:1,gap:5}}><Text style={styles.name}>{p.name}{p.id===state.selectedId?' · selected':''}</Text><Text style={styles.caption}>{p.category}{p.archived?' · archived':''} · {p.workplace?.name??'No GPS location'}</Text></View>
    <Text style={{color:p.color,fontSize:11,fontWeight:'800'}}>{active?'● IN':'○ OUT'}</Text>
   </Pressable>
   {active&&<Text style={[styles.timer,{color:p.color}]}>{duration((now-active.start)/3600000)} <Text style={styles.caption}>and counting</Text></Text>}
   <View style={styles.totals}>{[['Today',hours(shifts,b.day,now,now)],['Week',hours(shifts,b.week,now,now)],['Month',hours(shifts,b.month,now,now)],['All time',hours(shifts,0,now,now)]].map(([label,h])=><View key={label}><Text style={styles.caption}>{label}</Text><Text style={styles.total}>{duration(Number(h))}</Text></View>)}</View>
   <Text style={[styles.caption,{color:p.color}]}>{profileStatus(p,health)}</Text>
   {!!p.diagnostic&&<Text style={styles.warning}>{p.diagnostic}</Text>}
   <View style={styles.actions}>{!p.archived&&<><Action disabled={busy} color={p.color} title={active?'Clock out':'Clock in'} onPress={()=>run(()=>update(s=>clock(s,active?'out':'in','manual',Date.now(),'',p.id)))}/><Action title="Location & GPS" onPress={()=>onSettings(p.id)}/></>}<Action disabled={busy} title="Edit" onPress={()=>edit(p)}/><Action disabled={busy} title={p.archived?'Restore':'Archive'} onPress={()=>archive(p)}/><Action disabled={busy} color="#ed7272" title="Delete" onPress={()=>destroy(p)}/></View>
  </View>;
 })}
 <Modal visible={draft!==null} animationType="slide" onRequestClose={()=>setDraft(null)}><SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.editor} keyboardShouldPersistTaps="handled"><Text style={styles.title}>{draft&&state.profiles.some(p=>p.id===draft.id)?'Edit profile.':'A new chapter.'}</Text><Text style={styles.caption}>A profile is a tracker, never a login. Location is optional; configure it from Location & GPS after saving.</Text>
 {draft&&<>
 <Text style={styles.caption}>Name</Text><TextInput accessibilityLabel="Profile name" style={styles.input} value={draft.name} onChangeText={name=>setDraft({...draft,name})}/>
 <Text style={styles.caption}>Icon · a symbol, emoji, or short glyph</Text><TextInput accessibilityLabel="Profile icon" style={styles.input} maxLength={16} value={draft.icon} onChangeText={icon=>setDraft({...draft,icon})}/>
 <View style={styles.actions}>{['✦','☽','⚡','☠','♡','⚑','📚','🏋'].map(icon=><Action key={icon} title={icon} onPress={()=>setDraft({...draft,icon})}/>)}</View>
 <Text style={styles.caption}>Color · choose a swatch or enter #RRGGBB</Text><View style={styles.actions}>{colors.map(color=><Pressable key={color} accessibilityLabel={`Choose ${color}`} onPress={()=>setDraft({...draft,color})} style={{width:40,height:40,borderRadius:20,backgroundColor:color,borderWidth:draft.color===color?3:0,borderColor:'#fff'}}/>)}</View><TextInput accessibilityLabel="Profile color" autoCapitalize="none" style={styles.input} value={draft.color} onChangeText={color=>setDraft({...draft,color})}/>
 <Text style={styles.caption}>Category</Text><View style={styles.actions}>{categories.map(category=><Action key={category} color={draft.category===category?'#ed7272':'#b480ff'} title={`${draft.category===category?'● ':''}${category}`} onPress={()=>setDraft({...draft,category})}/>)}</View>
 <Text style={styles.caption}>Hourly rate · optional, blank means unpaid</Text><TextInput accessibilityLabel="Profile hourly rate" keyboardType="decimal-pad" style={styles.input} value={rate} onChangeText={setRate}/><Text style={styles.caption}>Fitness, study, personal time, or a job: every hour counts. Pay is never required.</Text>
 <Action title="Save profile" onPress={save} disabled={busy}/><Action title="Cancel" onPress={()=>setDraft(null)}/>
 </>}</ScrollView></SafeAreaView></Modal>
 </>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#0d0b11'},editor:{padding:24,gap:16},title:{fontSize:32,fontWeight:'900',color:'#f3edf8'},caption:{fontSize:11,color:'#9a94a6',lineHeight:18},warning:{fontSize:12,color:'#f2adac',lineHeight:18},card:{padding:18,gap:16,borderWidth:1,borderRadius:20,backgroundColor:'#18151e'},row:{flexDirection:'row',gap:12,alignItems:'center'},badge:{width:52,height:52,borderRadius:15,alignItems:'center',justifyContent:'center'},name:{color:'#f3edf8',fontWeight:'800',fontSize:18},timer:{fontSize:30,fontWeight:'700',fontVariant:['tabular-nums']},totals:{flexDirection:'row',justifyContent:'space-between',gap:8,flexWrap:'wrap'},total:{color:'#e8d4ff',fontWeight:'700',fontSize:14},actions:{flexDirection:'row',flexWrap:'wrap',gap:9},action:{backgroundColor:'#241b30',borderWidth:1,paddingHorizontal:13,paddingVertical:13,borderRadius:11,minHeight:44,alignItems:'center',justifyContent:'center'},input:{backgroundColor:'#18151e',borderWidth:1,borderColor:'#3a3045',borderRadius:11,padding:14,color:'#f5effa',fontSize:16}});
