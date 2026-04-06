-- Named account per imported CSV (e.g. "Amir - N26", "Nevena - N26")
-- Distinct from the existing `account` column which stores counterparty IBAN from the CSV row
alter table transactions
  add column if not exists account_name text;

create index if not exists transactions_user_account_name_idx
  on transactions (user_id, account_name);

-- Persist user's preferred spending analysis start date (e.g. ignore unemployment period)
alter table user_settings
  add column if not exists spending_date_from date;
