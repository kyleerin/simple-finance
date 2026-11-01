begin;

create table public.spending_entries (
  id uuid not null,
  owner_id uuid not null default auth.uid() references public.profiles(id),
  category_id uuid not null,
  amount_cents bigint not null check (amount_cents between 1 and 99999999999),
  purchase_date date not null check (purchase_date between date '1900-01-01' and date '9999-12-31'),
  note text check (note is null or (note = btrim(note) and char_length(note) between 1 and 500)),
  created_at timestamptz not null default now(),
  primary key (owner_id, id),
  foreign key (category_id, owner_id) references public.categories(id, owner_id) on delete restrict
);
create index spending_entries_owner_date on public.spending_entries (owner_id, purchase_date desc, created_at desc);

alter table public.spending_entries enable row level security;
revoke all on public.spending_entries from public, anon, authenticated;
-- Editing/deleting spending belongs to phase 4. No such privileges yet.
grant select, insert on public.spending_entries to authenticated;
create policy "Read own spending" on public.spending_entries for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Insert own spending" on public.spending_entries for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create or replace function public.check_budget_preferences()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'Invalid timezone' using errcode = '23514';
  end if;
  if new.currency <> old.currency and (
    exists (select 1 from public.monthly_limits where owner_id = new.id)
    or exists (select 1 from public.spending_entries where owner_id = new.id)
  ) then
    raise exception 'Currency cannot change while budgets or spending exist' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.check_spending_category()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- Same lock protocol as limits: serialize against currency changes.
  perform 1 from public.profiles where id = new.owner_id for share;
  perform 1 from public.categories
    where id = new.category_id and owner_id = new.owner_id and archived_at is null
    for share;
  if not found then
    raise exception 'Choose an active category' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger check_spending_category before insert on public.spending_entries
  for each row execute function public.check_spending_category();

create function public.record_spending(
  submission_id uuid, category uuid, cents bigint, purchased_on date, entry_note text
)
returns public.spending_entries
language plpgsql security invoker set search_path = '' as $$
declare receipt public.spending_entries;
begin
  if auth.uid() is null or submission_id is null then
    raise exception 'Authentication and submission ID required' using errcode = '22023';
  end if;
  -- Serialize retries for this owner/submission, even concurrent requests.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text || ':' || submission_id::text, 0)
  );
  select * into receipt from public.spending_entries
    where owner_id = auth.uid() and id = submission_id;
  if found then
    -- Return the original, never overwrite it, even if the retry payload differs
    -- or the category has since been archived. The API identifies changed retries.
    return receipt;
  end if;
  insert into public.spending_entries (id, owner_id, category_id, amount_cents, purchase_date, note)
    values (submission_id, auth.uid(), category, cents, purchased_on, nullif(btrim(entry_note), ''))
    returning * into receipt;
  return receipt;
end;
$$;

revoke all on function public.check_spending_category(),
  public.record_spending(uuid, uuid, bigint, date, text) from public, anon;
grant execute on function public.record_spending(uuid, uuid, bigint, date, text) to authenticated;

notify pgrst, 'reload schema';

commit;
