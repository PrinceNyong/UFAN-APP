-- Ufan v0.6 starter. Execute in a NEW Supabase project SQL editor.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 role text not null default 'entrepreneur' check(role in ('entrepreneur','agent','admin')),
 created_at timestamptz not null default now()
);
create table public.businesses (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id),
 name text not null check(length(trim(name)) between 2 and 100),
 sector text not null default 'other',
 created_at timestamptz not null default now()
);
create table public.agent_assignments (
 agent_id uuid not null references public.profiles(id),
 business_id uuid not null references public.businesses(id) on delete cascade,
 primary key(agent_id,business_id)
);
create table public.assessments (
 business_id uuid primary key references public.businesses(id) on delete cascade,
 answers jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table public.claims (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 task_key text not null,
 evidence_summary text not null check(length(trim(evidence_summary)) between 25 and 2000),
 submitted_by uuid not null references public.profiles(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected','more_evidence')),
 review_note text,
 reviewed_by uuid references public.profiles(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index claims_one_active_task on public.claims(business_id,task_key) where status in ('pending','approved');
create table public.points_ledger (
 id uuid primary key default gen_random_uuid(),
 claim_id uuid not null unique references public.claims(id),
 business_id uuid not null references public.businesses(id),
 points integer not null check(points > 0 and points <= 150),
 created_at timestamptz not null default now()
);
create table public.audit_events (
 id bigint generated always as identity primary key,
 claim_id uuid references public.claims(id),
 actor_id uuid references public.profiles(id),
 action text not null,
 detail text,
 created_at timestamptz not null default now()
);
create or replace function public.make_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.make_profile();
create or replace function public.my_role() returns text language sql stable security definer set search_path = '' as $$ select role from public.profiles where id = (select auth.uid()) $$;
create or replace function public.can_access_business(b uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.businesses x where x.id=b and (x.owner_id=(select auth.uid()) or exists(select 1 from public.agent_assignments a where a.business_id=b and a.agent_id=(select auth.uid())) or public.my_role()='admin')) $$;
create or replace function public.can_submit_business(b uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.businesses x where x.id=b and (x.owner_id=(select auth.uid()) or (public.my_role()='agent' and exists(select 1 from public.agent_assignments a where a.business_id=b and a.agent_id=(select auth.uid()))))) $$;
-- Never expose direct UPDATE of claims or INSERT of ledger to client roles.
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.agent_assignments enable row level security;
alter table public.assessments enable row level security;
alter table public.claims enable row level security;
alter table public.points_ledger enable row level security;
alter table public.audit_events enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()) or public.my_role()='admin');
create policy businesses_read on public.businesses for select to authenticated using(public.can_access_business(id));
create policy businesses_create on public.businesses for insert to authenticated with check(owner_id=(select auth.uid()) and public.my_role()='entrepreneur');
create policy businesses_update on public.businesses for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy assignments_read on public.agent_assignments for select to authenticated using(agent_id=(select auth.uid()) or public.my_role()='admin');
create policy assessments_read on public.assessments for select to authenticated using(public.can_access_business(business_id));
create policy assessments_insert on public.assessments for insert to authenticated with check(public.can_submit_business(business_id));
create policy assessments_update on public.assessments for update to authenticated using(public.can_submit_business(business_id)) with check(public.can_submit_business(business_id));
create policy claims_read on public.claims for select to authenticated using(public.can_access_business(business_id));
create policy claims_insert on public.claims for insert to authenticated with check(submitted_by=(select auth.uid()) and public.can_submit_business(business_id) and status='pending' and reviewed_by is null and reviewed_at is null and review_note is null);
create policy ledger_read on public.points_ledger for select to authenticated using(public.can_access_business(business_id));
create policy audit_read on public.audit_events for select to authenticated using(public.my_role()='admin');
-- Restrict direct grants; policies are an additional layer.
revoke all on public.profiles,public.businesses,public.agent_assignments,public.assessments,public.claims,public.points_ledger,public.audit_events from anon,authenticated;
grant select on public.profiles,public.agent_assignments,public.points_ledger,public.audit_events to authenticated;
grant select,insert,update on public.businesses,public.assessments to authenticated;
grant select,insert on public.claims to authenticated;
create or replace function public.review_claim(p_claim_id uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.claims%rowtype; n integer;
begin
 if (select auth.uid()) is null or public.my_role() <> 'admin' then raise exception 'Not authorized'; end if;
 if p_decision not in ('approved','rejected','more_evidence') or length(trim(coalesce(p_note,''))) < 8 then raise exception 'Invalid decision or note'; end if;
 select * into c from public.claims where id=p_claim_id for update;
 if not found or c.status <> 'pending' then raise exception 'Claim is not pending'; end if;
 update public.claims set status=p_decision,review_note=p_note,reviewed_by=(select auth.uid()),reviewed_at=now() where id=p_claim_id;
 if p_decision='approved' then
  n:=case c.task_key when 'records7' then 50 when 'records30' then 100 when 'documents' then 40 when 'inventory' then 50 when 'goal' then 20 when 'feedback' then 30 else 30 end;
  insert into public.points_ledger(claim_id,business_id,points) values(c.id,c.business_id,n);
 end if;
 insert into public.audit_events(claim_id,actor_id,action,detail) values(c.id,(select auth.uid()),p_decision,p_note);
 return jsonb_build_object('status',p_decision,'points_awarded',case when p_decision='approved' then n else 0 end);
end $$;
revoke all on function public.review_claim(uuid,text,text) from public,anon;
grant execute on function public.review_claim(uuid,text,text) to authenticated;
-- ADMIN BOOTSTRAP: After creating your own account, run this manually in SQL editor,
-- replacing the placeholder with your auth.users UUID. Never add admin self-registration.
-- update public.profiles set role='admin' where id='YOUR-USER-UUID';
-- Assign agents only through trusted admin SQL or a later server-side admin endpoint:
-- update public.profiles set role='agent' where id='AGENT-USER-UUID';
-- insert into public.agent_assignments(agent_id,business_id) values('AGENT-USER-UUID','BUSINESS-UUID');
