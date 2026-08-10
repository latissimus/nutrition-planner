-- Zusätzliche, lokal erzeugte Hintergrundklänge für den Meditationstimer.

alter table public.routines drop constraint if exists routines_ambient_sound_check;
alter table public.routines add constraint routines_ambient_sound_check
  check (ambient_sound in ('off', 'rain', 'campfire', 'space', 'forest', 'ocean', 'brown'));
