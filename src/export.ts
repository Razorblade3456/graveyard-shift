import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { read, restore } from './store';
import { csv, profileShifts } from './core';
export async function exportData(backup=false,profileId='all'){const state=read();const file=new File(Paths.cache,`graveyard-shift-${Date.now()}.${backup?'json':'csv'}`);file.create();file.write(backup?JSON.stringify({version:2,state},null,2):csv(profileShifts(state,profileId),state.profiles));if(!await Sharing.isAvailableAsync())throw Error('Sharing is unavailable on this device.');await Sharing.shareAsync(file.uri,{mimeType:backup?'application/json':'text/csv',UTI:backup?'public.json':'public.comma-separated-values-text'});}
export async function importData(){const result=await DocumentPicker.getDocumentAsync({type:['application/json','text/plain'],copyToCacheDirectory:true});if(!result.canceled)restore(await new File(result.assets[0].uri).text());}
