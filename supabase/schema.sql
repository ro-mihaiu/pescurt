-- Run in the SQL editor of the PeScurt Supabase project.
create table public.admins (
  user_id uuid primary key references auth.users on delete cascade
);

create table public.documents (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  subject text not null,
  note text,
  file_type text,
  created_at timestamptz not null default now(),
  outputs jsonb not null default '{}',
  deleting boolean not null default false,
  check ((note is null) <> (file_type is null))
);
create index documents_owner_recent on public.documents (user_id, created_at desc);

create table public.student_requests (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  applicant_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  file_type text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users on delete set null,
  reason text
);
create unique index one_open_student_request on public.student_requests (user_id)
  where status in ('pending', 'approved');
create index student_expiration on public.student_requests (expires_at) where file_type is not null;

create table public.billing_customers (
  user_id uuid primary key references auth.users on delete cascade,
  customer_id text not null unique
);
create table public.entitlements (
  stripe_id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly', 'student', 'lifetime')),
  active boolean not null,
  expires_at timestamptz,
  observed_at timestamptz not null
);
create index entitlement_owner on public.entitlements (user_id);

create table public.daily_documents (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  document_id uuid not null,
  completed boolean not null default false,
  primary key (user_id, day, document_id)
);
create table public.processing_jobs (
  document_id uuid primary key references public.documents on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  token uuid not null,
  expires_at timestamptz not null
);
create index processing_jobs_owner on public.processing_jobs (user_id);

alter table public.admins enable row level security;
alter table public.documents enable row level security;
alter table public.student_requests enable row level security;
alter table public.billing_customers enable row level security;
alter table public.entitlements enable row level security;
alter table public.daily_documents enable row level security;
alter table public.processing_jobs enable row level security;

revoke all on public.admins, public.documents, public.student_requests, public.billing_customers,
  public.entitlements, public.daily_documents, public.processing_jobs from anon, authenticated;
grant select, insert, update, delete on public.admins, public.documents, public.student_requests,
  public.billing_customers, public.entitlements, public.daily_documents, public.processing_jobs to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('study-documents', 'study-documents', false, 3145728, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('student-proofs', 'student-proofs', false, 3145728, array['application/pdf','image/jpeg','image/png','image/webp']);
-- PeScurt never grants anon/authenticated storage policies for these buckets.
-- A restrictive policy also prevents an existing broad policy granting access.
create policy pescurt_private_objects on storage.objects as restrictive for all to anon, authenticated
  using (bucket_id not in ('study-documents','student-proofs'))
  with check (bucket_id not in ('study-documents','student-proofs'));

create function public.current_plan(p_user uuid) returns text
language sql stable set search_path = '' as $$
  select coalesce((
    select plan from public.entitlements
    where user_id = p_user and active and (expires_at is null or expires_at > now())
      and (plan <> 'student' or exists (
        select 1 from public.student_requests where user_id = p_user and status = 'approved'
      ))
    order by case plan when 'lifetime' then 0 when 'yearly' then 1 when 'monthly' then 2 else 3 end
    limit 1
  ), 'free');
$$;

create function public.account_usage(p_user uuid, p_day date) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('plan', public.current_plan(p_user), 'used', (
    select count(*) from public.daily_documents d
    where d.user_id = p_user and d.day = p_day and (d.completed or exists (
      select 1 from public.processing_jobs j where j.document_id = d.document_id
        and j.day = d.day and j.expires_at > now()
    ))
  ));
$$;

create function public.begin_processing(p_user uuid, p_document uuid, p_day date, p_action text, p_token uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
  doc public.documents%rowtype;
  quota integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select * into doc from public.documents where id = p_document and user_id = p_user and not deleting;
  if not found then return jsonb_build_object('status','missing'); end if;
  if doc.outputs ? p_action then return jsonb_build_object('status','cached','output',doc.outputs -> p_action); end if;
  delete from public.processing_jobs where user_id = p_user and expires_at <= now();
  delete from public.daily_documents d where d.user_id = p_user and not d.completed and not exists (
    select 1 from public.processing_jobs j where j.document_id = d.document_id and j.day = d.day
  );
  if exists (select 1 from public.processing_jobs where document_id = p_document) then
    return jsonb_build_object('status','busy');
  end if;
  quota := case when public.current_plan(p_user) = 'free' then 2 else 5 end;
  if not exists (select 1 from public.daily_documents where user_id = p_user and day = p_day and document_id = p_document)
    and (select count(*) from public.daily_documents where user_id = p_user and day = p_day) >= quota then
    return jsonb_build_object('status','limit');
  end if;
  insert into public.daily_documents (user_id, day, document_id) values (p_user, p_day, p_document) on conflict do nothing;
  insert into public.processing_jobs values (p_document, p_user, p_day, p_token, now() + interval '3 minutes');
  return jsonb_build_object('status','ready','note',doc.note,'file_type',doc.file_type,'subject',doc.subject);
end;
$$;

create function public.finish_processing(p_user uuid, p_document uuid, p_token uuid, p_action text, p_output text)
returns boolean language plpgsql set search_path = '' as $$
declare
  job public.processing_jobs%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  delete from public.processing_jobs where document_id = p_document and user_id = p_user and token = p_token returning * into job;
  if not found then return false; end if;
  if p_output is null then
    delete from public.daily_documents where user_id = p_user and day = job.day and document_id = p_document and not completed;
  else
    update public.daily_documents set completed = true where user_id = p_user and day = job.day and document_id = p_document;
    update public.documents set outputs = outputs || jsonb_build_object(p_action, p_output)
      where id = p_document and user_id = p_user;
  end if;
  return true;
end;
$$;

create function public.mark_document_deleting(p_user uuid, p_document uuid)
returns text language plpgsql set search_path = '' as $$
declare
  kind text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if exists (select 1 from public.processing_jobs where document_id = p_document and user_id = p_user and expires_at > now()) then
    return 'busy';
  end if;
  update public.documents set deleting = true where id = p_document and user_id = p_user returning file_type into kind;
  if not found then return 'missing'; end if;
  return coalesce(kind, 'note');
end;
$$;

create function public.sync_entitlement(p_id text, p_user uuid, p_plan text, p_active boolean, p_expires timestamptz, p_observed timestamptz)
returns void language sql set search_path = '' as $$
  insert into public.entitlements values (p_id, p_user, p_plan, p_active, p_expires, p_observed)
  on conflict (stripe_id) do update set active = excluded.active, plan = excluded.plan,
    expires_at = excluded.expires_at, observed_at = excluded.observed_at
  where entitlements.user_id = excluded.user_id and entitlements.observed_at <= excluded.observed_at;
$$;

revoke execute on function public.current_plan(uuid), public.account_usage(uuid,date),
  public.begin_processing(uuid,uuid,date,text,uuid), public.finish_processing(uuid,uuid,uuid,text,text),
  public.mark_document_deleting(uuid,uuid), public.sync_entitlement(text,uuid,text,boolean,timestamptz,timestamptz)
  from public, anon, authenticated;
grant execute on function public.current_plan(uuid), public.account_usage(uuid,date),
  public.begin_processing(uuid,uuid,date,text,uuid), public.finish_processing(uuid,uuid,uuid,text,text),
  public.mark_document_deleting(uuid,uuid), public.sync_entitlement(text,uuid,text,boolean,timestamptz,timestamptz)
  to service_role;

create function public.find_documents(p_user uuid, p_search text, p_offset integer)
returns table (id uuid, title text, subject text, created_at timestamptz, summary text, deleting boolean)
language sql stable set search_path = '' as $$
  select d.id, d.title, d.subject, d.created_at, left(d.outputs ->> 'summary', 230), d.deleting
  from public.documents d
  where d.user_id = p_user and (p_search = '' or strpos(lower(d.title), lower(p_search)) > 0
    or strpos(lower(d.subject), lower(p_search)) > 0)
  order by d.created_at desc, d.id desc offset p_offset limit 21;
$$;
revoke execute on function public.find_documents(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.find_documents(uuid,text,integer) to service_role;
