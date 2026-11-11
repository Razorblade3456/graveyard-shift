const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
test('PostgreSQL RLS isolates two users and anonymous access; CAS rejects stale revisions',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/001_sync.sql'),'utf8'));
 const doc=JSON.stringify({state:{profiles:[],shifts:[]},recovered:[]});
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`);
 let reply=await db.query('select public.gs_compare_and_swap(0,$1::jsonb) as result',[doc]);assert.equal(reply.rows[0].result.applied,true);assert.equal(reply.rows[0].result.revision,1);
 reply=await db.query('select public.gs_compare_and_swap(0,$1::jsonb) as result',[doc]);assert.equal(reply.rows[0].result.applied,false);
 await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);`);
 assert.equal((await db.query('select * from public.gs_workspaces')).rows.length,0);
 await assert.rejects(db.query(`insert into public.gs_workspaces(user_id) values('00000000-0000-0000-0000-000000000001')`),/row-level security/);
 const changed=await db.query(`update public.gs_workspaces set revision=99 where user_id='00000000-0000-0000-0000-000000000001' returning user_id`);assert.equal(changed.rows.length,0);
 await db.query('select public.gs_compare_and_swap(0,$1::jsonb)',[doc]);assert.equal((await db.query('select * from public.gs_workspaces')).rows.length,1);
 await db.exec(`reset role;set role anon;`);await assert.rejects(db.query('select * from public.gs_workspaces'),/permission denied/);await assert.rejects(db.query('select public.gs_compare_and_swap(0,$1::jsonb)',[doc]),/permission denied/);
 await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`);assert.equal((await db.query('select revision from public.gs_workspaces')).rows[0].revision,1);
 }finally{await db.close();}
});
