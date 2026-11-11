import * as SecureStore from 'expo-secure-store';
type Manifest={version:string;count:number};
export const authStorage={
 async getItem(key:string){const raw=await SecureStore.getItemAsync(key);if(!raw)return null;const m=JSON.parse(raw) as Manifest;const parts=await Promise.all(Array.from({length:m.count},(_,i)=>SecureStore.getItemAsync(`${key}.${m.version}.${i}`)));return parts.some(p=>p===null)?null:parts.join('');},
 async setItem(key:string,value:string){const old=await SecureStore.getItemAsync(key),version=`${Date.now()}-${Math.random().toString(36).slice(2)}`,parts=value.match(/.{1,500}/gs)??[''];for(let i=0;i<parts.length;i++)await SecureStore.setItemAsync(`${key}.${version}.${i}`,parts[i]);await SecureStore.setItemAsync(key,JSON.stringify({version,count:parts.length}));if(old){const m=JSON.parse(old) as Manifest;await Promise.all(Array.from({length:m.count},(_,i)=>SecureStore.deleteItemAsync(`${key}.${m.version}.${i}`)));}},
 async removeItem(key:string){const raw=await SecureStore.getItemAsync(key);await SecureStore.deleteItemAsync(key);if(raw){const m=JSON.parse(raw) as Manifest;await Promise.all(Array.from({length:m.count},(_,i)=>SecureStore.deleteItemAsync(`${key}.${m.version}.${i}`)));}}
};
