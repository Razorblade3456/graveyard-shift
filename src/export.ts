import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { read, restore } from './store';
import { csv, profileShifts } from './core';
export async function exportData(backup=false,profileId='all'){const state=read();const file=new File(Paths.cache,`graveyard-shift-${Date.now()}.${backup?'json':'csv'}`);file.create();file.write(backup?JSON.stringify({version:2,state},null,2):csv(profileShifts(state,profileId),state.profiles));if(!await Sharing.isAvailableAsync())throw Error('Sharing is unavailable on this device.');await Sharing.shareAsync(file.uri,{mimeType:backup?'application/json':'text/csv',UTI:backup?'public.json':'public.comma-separated-values-text'});}
export async function importData(){const result=await DocumentPicker.getDocumentAsync({type:['application/json','text/plain'],copyToCacheDirectory:true});if(!result.canceled)restore(await new File(result.assets[0].uri).text());}

export async function exportRecovery(payload:unknown){const file=new File(Paths.cache,'graveyard-recovery-'+Date.now()+'.json');file.create();file.write(JSON.stringify({kind:'graveyard-recovery',version:2,state:read(),recovery:payload},null,2));if(!await Sharing.isAvailableAsync())throw Error('File sharing unavailable.');await Sharing.shareAsync(file.uri,{mimeType:'application/json',UTI:'public.json'});}

export async function exportSnapshot(state:import('./core').State,name='graveyard-local-backup'){const file=new File(Paths.cache,name+'-'+Date.now()+'.json');file.create();file.write(JSON.stringify({version:2,state},null,2));if(!await Sharing.isAvailableAsync())throw Error('File sharing unavailable.');await Sharing.shareAsync(file.uri,{mimeType:'application/json',UTI:'public.json'});}
