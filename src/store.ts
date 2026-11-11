import { accountId, readAccount, updateAccount } from './account-store';
export { scopeToken } from './account-store';
import * as SQLite from 'expo-sqlite';
import { decodeBackup, initialState, migrate, State, validateState } from './core';
const db=SQLite.openDatabaseSync('graveyard-shift.db');
db.execSync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);');
db.withTransactionSync(()=>{const row=db.getFirstSync<{json:string}>('SELECT json FROM state WHERE id=1');if(row){const raw=JSON.parse(row.json);if(raw.version!==2){const next=migrate(raw);validateState(next);db.runSync('UPDATE state SET json=? WHERE id=1',JSON.stringify(next));}}});
export function read():State {if(accountId())return readAccount();const row=db.getFirstSync<{json:string}>('SELECT json FROM state WHERE id=1');return row?JSON.parse(row.json):initialState();}
export function update(fn:(state:State)=>State):State {if(accountId())return updateAccount(fn);let result:State;db.withTransactionSync(()=>{result=fn(read());validateState(result);db.runSync('INSERT INTO state(id,json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json',JSON.stringify(result));});return result!;}
export function restore(raw:string){const next=decodeBackup(raw);return update(()=>next);}

export function readGuest():State {const row=db.getFirstSync<{json:string}>('SELECT json FROM state WHERE id=1');return row?migrate(JSON.parse(row.json)):initialState();}
