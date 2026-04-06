-- Add offset support to spending_payees.
-- When a payee has offsets_category set, all income transactions from that
-- payee are subtracted from that category's net total in analysis.
--
-- Examples:
--   Partner wire (Frederic contribution) → offsets_category = 'housing'
--   Mutualité reimbursement              → offsets_category = 'health'

alter table spending_payees
  add column if not exists offsets_category text;
