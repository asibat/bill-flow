alter table public.bills
  add column ingestion_method text
    check (ingestion_method in ('doccle_html_pdf', 'email_body_text', 'email_attachment', 'upload_pdf', 'upload_image', 'manual_entry'));

update public.bills
set ingestion_method = case
  when source = 'doccle' then 'doccle_html_pdf'
  when source = 'email' and raw_pdf_path is not null then 'email_attachment'
  when source = 'email' then 'email_body_text'
  when source = 'upload' and raw_pdf_path ilike '%.pdf' then 'upload_pdf'
  when source = 'upload' then 'upload_image'
  when source = 'manual' then 'manual_entry'
  else null
end
where ingestion_method is null;
