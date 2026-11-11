import * as SQLite from 'expo-sqlite';
const db=SQLite.openDatabaseSync('graveyard-shift-cloud.db');
db.execSync('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY,value TEXT NOT NULL);');
export const kv={get(key:string){return db.getFirstSync<{value:string}>('SELECT value FROM kv WHERE key=?',key)?.value??null;},set(key:string,value:string){db.runSync('INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,value);},remove(key:string){db.runSync('DELETE FROM kv WHERE key=?',key);},transaction<T>(fn:()=>T){let result:T;db.withTransactionSync(()=>{result=fn();});return result!;}};
