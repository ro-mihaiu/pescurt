create schema if not exists pescurt_private;
create table if not exists pescurt_private.auth_limits (
  bucket text primary key,
  until_at timestamptz not null,
  hits integer not null
);
create index if not exists auth_limits_expiry on pescurt_private.auth_limits(until_at);
revoke all on pescurt_private.auth_limits from public, anon, authenticated;
create or replace function public.consume_auth_limit(p_key text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_limit not between 1 and 100 or p_seconds not between 1 and 3600 then
    raise exception 'invalid window';
  end if;
  if random() < 0.01 then
    delete from pescurt_private.auth_limits where until_at <= now();
  end if;
  insert into pescurt_private.auth_limits as b (bucket, until_at, hits)
    values (p_key, now() + make_interval(secs => p_seconds), 1)
    on conflict (bucket) do update set
      hits = case when b.until_at <= now() then 1 else b.hits + 1 end,
      until_at = case when b.until_at <= now() then excluded.until_at else b.until_at end
    where b.until_at <= now() or b.hits < p_limit
    returning hits into n;
  return n is not null;
end $$;
revoke all on function public.consume_auth_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_auth_limit(text, integer, integer) to service_role;
