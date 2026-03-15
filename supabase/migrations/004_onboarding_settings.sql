-- Add onboarding and privacy fields to user_settings
alter table public.user_settings
  add column display_name          text,
  add column default_privacy_level text not null default 'strict'
    check (default_privacy_level in ('strict', 'accuracy')),
  add column onboarding_completed  boolean not null default false;
