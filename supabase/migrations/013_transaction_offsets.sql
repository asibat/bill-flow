-- Per-transaction offset: this income transaction reduces a specific category's net cost.
-- Takes precedence over payee-level offsets_category in spending_payees.
-- Example: a specific insurance reimbursement → offsets health for that exact transaction.

alter table transactions
  add column if not exists offsets_category text;
