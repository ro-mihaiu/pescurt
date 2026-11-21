create table public.policy_acknowledgements (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key(user_id, version)
);
alter table public.policy_acknowledgements enable row level security;
revoke all on public.policy_acknowledgements from public, anon, authenticated;
grant select, insert on public.policy_acknowledgements to service_role;
create function pescurt_private.signup_policy_ack() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data->>'pescurt_policy' = '2026-11-21' then
    insert into public.policy_acknowledgements(user_id,version) values(new.id,'2026-11-21');
  end if;
  return new;
end $$;
revoke all on function pescurt_private.signup_policy_ack() from public, anon, authenticated;
create trigger pescurt_signup_policy after insert on auth.users
  for each row execute function pescurt_private.signup_policy_ack();
