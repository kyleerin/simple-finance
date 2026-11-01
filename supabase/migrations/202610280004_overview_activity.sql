begin;

-- Keep deleted rows as retry tombstones: old submission IDs must never recreate
-- a purchase. Deleted rows do not count towards spending or activity.
alter table public.spending_entries
  add column deleted_at timestamptz,
  add column version bigint not null default 0 check (version between 0 and 9007199254740990),
  add column updated_at timestamptz not null default now();

grant update (category_id, amount_cents, purchase_date, note, deleted_at)
  on public.spending_entries to authenticated;
create policy "Update own spending" on public.spending_entries for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create or replace function public.check_spending_category()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.profiles where id = new.owner_id for share;
  -- Permit correcting an existing archived-category purchase without restoring
  -- that category. Moving into a different archived category is not allowed.
  if tg_op = 'INSERT' or new.category_id <> old.category_id then
    perform 1 from public.categories
      where id = new.category_id and owner_id = new.owner_id and archived_at is null
      for share;
    if not found then
      raise exception 'Choose an active category' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
drop trigger check_spending_category on public.spending_entries;
create trigger check_spending_category before insert or update on public.spending_entries
  for each row execute function public.check_spending_category();

create function public.version_spending()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.deleted_at is not null then
    raise exception 'Deleted spending cannot be changed or restored' using errcode = '23514';
  end if;
  new.version := old.version + 1;
  new.updated_at := clock_timestamp();
  if new.deleted_at is not null then
    -- A deletion only hides the original; do not change its financial details.
    new.category_id := old.category_id;
    new.amount_cents := old.amount_cents;
    new.purchase_date := old.purchase_date;
    new.note := old.note;
    new.deleted_at := clock_timestamp();
  end if;
  return new;
end;
$$;
create trigger version_spending before update on public.spending_entries
  for each row execute function public.version_spending();
revoke all on function public.version_spending() from public, anon;

-- One SQL snapshot, aggregated before PostgREST pagination. Never calculate
-- totals from a truncated activity page. JSONB is a single scalar response.
create function public.budget_overview(target_month date)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or target_month is null
    or extract(day from target_month) <> 1
    or target_month not between date '1900-01-01' and date '9999-12-01' then
    raise exception 'Invalid month' using errcode = '22023';
  end if;
  with spending as (
    select category_id, sum(amount_cents)::bigint as spent_cents
    from public.spending_entries
    where owner_id = auth.uid() and deleted_at is null
      and purchase_date >= target_month
      and purchase_date < target_month + interval '1 month'
    group by category_id
  ), breakdown as (
    select c.id, c.name, c.archived_at, c.display_order,
      l.amount_cents as limit_cents, coalesce(s.spent_cents, 0) as spent_cents
    from public.categories c
    left join public.monthly_limits l
      on l.category_id = c.id and l.owner_id = c.owner_id and l.month = target_month
    left join spending s on s.category_id = c.id
    where c.owner_id = auth.uid()
  )
  select jsonb_build_object(
    'categories', coalesce(jsonb_agg(to_jsonb(b) order by b.display_order, b.id), '[]'::jsonb),
    'budgeted_cents', coalesce(sum(limit_cents), 0),
    'spent_cents', coalesce(sum(spent_cents), 0),
    'missing_limits', count(*) filter (
      where limit_cents is null and (archived_at is null or spent_cents > 0)
    )
  ) into result from breakdown b;
  return result;
end;
$$;
revoke all on function public.budget_overview(date) from public, anon;
grant execute on function public.budget_overview(date) to authenticated;

notify pgrst, 'reload schema';
commit;
