-- Run once in the Supabase SQL editor. Only a publishable/anon key belongs in the app.
create table public.gs_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0 check(revision>=0),
 document jsonb,
 updated_at timestamptz not null default now(),
 check(document is null or (jsonb_typeof(document->'state'->'profiles')='array' and jsonb_typeof(document->'state'->'shifts')='array' and jsonb_typeof(document->'recovered')='array'))
);
alter table public.gs_workspaces enable row level security;
alter table public.gs_workspaces force row level security;
create policy own_workspace_select on public.gs_workspaces for select to authenticated using ((select auth.uid())=user_id);
create policy own_workspace_insert on public.gs_workspaces for insert to authenticated with check ((select auth.uid())=user_id);
create policy own_workspace_update on public.gs_workspaces for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.gs_workspaces from anon, authenticated;
grant select, insert, update on public.gs_workspaces to authenticated;

create or replace function public.gs_compare_and_swap(p_expected_revision bigint,p_document jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.gs_workspaces%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_document is null or jsonb_typeof(p_document->'state'->'profiles') is distinct from 'array'
 or jsonb_typeof(p_document->'state'->'shifts') is distinct from 'array'
 or jsonb_typeof(p_document->'recovered') is distinct from 'array' then raise exception 'Invalid document'; end if;
 insert into public.gs_workspaces(user_id) values(auth.uid()) on conflict do nothing;
 select * into current_row from public.gs_workspaces where user_id=auth.uid() for update;
 if current_row.revision<>p_expected_revision then
  return jsonb_build_object('applied',false,'revision',current_row.revision);
 end if;
 if current_row.document is distinct from p_document then
  update public.gs_workspaces set document=p_document,revision=revision+1,updated_at=now() where user_id=auth.uid() returning * into current_row;
 end if;
 return jsonb_build_object('applied',true,'revision',current_row.revision);
end;
$$;
revoke all on function public.gs_compare_and_swap(bigint,jsonb) from public, anon;
grant execute on function public.gs_compare_and_swap(bigint,jsonb) to authenticated;
