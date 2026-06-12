-- The append-only trigger must still allow LAWFUL erasure (org/site deletion,
-- crypto-shred) while blocking targeted tampering. We gate DELETE behind a
-- transaction-local flag that only deliberate purge code sets:
--   select set_config('skope.purge', 'on', true);  -- inside the deletion txn
-- UPDATE is never allowed; corrections are always new rows.
create or replace function skope_block_mutation() returns trigger as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('skope.purge', true) = 'on' then
      return old; -- deliberate purge / erasure — allow the cascade
    end if;
    raise exception 'consent_receipts is append-only; receipts cannot be deleted individually';
  end if;
  raise exception 'consent_receipts is append-only; corrections must be new rows';
end;
$$ language plpgsql;
