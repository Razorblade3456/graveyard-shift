import { csv, profileShifts } from './core';
import { read, restore } from './store';

export async function exportData(backup=false,profileId='all'){
 const state=read();
 const blob=new Blob([backup?JSON.stringify({version:2,state},null,2):csv(profileShifts(state,profileId),state.profiles)],{type:backup?'application/json':'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=`graveyard-shift-${Date.now()}.${backup?'json':'csv'}`;
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function importData(){
 // Native pickers and the File API in expo-file-system are not available in the browser.
 await new Promise<void>((resolve,reject)=>{
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
  input.oncancel=()=>{input.remove();resolve();};
  input.onchange=async()=>{try{const file=input.files?.[0];if(file)restore(await file.text());resolve();}catch(e){reject(e);}finally{input.remove();}};
  input.click();
 });
}
