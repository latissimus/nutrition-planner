-- Routinen können als Meditationstemplate einen eigenen Timer oder einen
-- externen Meditationslink verwenden.

alter table public.routines
  add column if not exists template_type text not null default 'custom',
  add column if not exists duration_minutes smallint,
  add column if not exists external_url text,
  add column if not exists ambient_sound text not null default 'off',
  add column if not exists ambient_volume real not null default 0.35,
  add column if not exists gong_volume real not null default 0.7;

alter table public.routines drop constraint if exists routines_template_type_check;
alter table public.routines add constraint routines_template_type_check
  check (template_type in ('custom', 'meditation', 'mobility'));

alter table public.routines drop constraint if exists routines_duration_minutes_check;
alter table public.routines add constraint routines_duration_minutes_check
  check (duration_minutes is null or duration_minutes in (2, 5, 10, 15, 20));

alter table public.routines drop constraint if exists routines_external_url_check;
alter table public.routines add constraint routines_external_url_check
  check (external_url is null or external_url ~ '^https?://');

alter table public.routines drop constraint if exists routines_ambient_sound_check;
alter table public.routines add constraint routines_ambient_sound_check
  check (ambient_sound in ('off', 'rain', 'forest', 'ocean', 'brown'));

alter table public.routines drop constraint if exists routines_ambient_volume_check;
alter table public.routines add constraint routines_ambient_volume_check
  check (ambient_volume between 0 and 1);

alter table public.routines drop constraint if exists routines_gong_volume_check;
alter table public.routines add constraint routines_gong_volume_check
  check (gong_volume between 0 and 1);
