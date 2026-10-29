-- Supabase owns identity in auth.users. This table holds app-specific data.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create policy "Read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create function public.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke all on function public.create_user_profile() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_user_profile();

-- Also support an owner created before this migration.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
