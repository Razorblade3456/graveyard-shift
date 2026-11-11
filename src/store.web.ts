import { accountId, readAccount, updateAccount } from './account-store';
export { scopeToken } from './account-store';
import { decodeBackup, initialState, migrate, type State, validateState } from './core';

export const STORAGE_KEY='graveyard-shift-state-v2';
function load():State {
 const raw=window.localStorage.getItem(STORAGE_KEY);
 if(raw===null)return initialState();
 const state=migrate(JSON.parse(raw));validateState(state);return state;
}
export function read():State {if(accountId())return readAccount();
 try{return load();}catch{return {...initialState(),monitorError:'Browser storage is unavailable or contains invalid records. Enable site storage or restore a backup. Existing data has not been overwritten.'};}
}
export function update(fn:(state:State)=>State):State {if(accountId())return updateAccount(fn);
 // No in-memory success fallback: if persistence fails, clocking must report failure.
 const next=fn(load());validateState(next);
 try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{throw Error('Could not save your records. Browser storage is blocked or full. Free space or allow site storage, then try again.');}
 return next;
}
export function restore(raw:string){const next=decodeBackup(raw);validateState(next);if(accountId())return updateAccount(()=>next);window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));return next;}

export function readGuest():State {return load();}
