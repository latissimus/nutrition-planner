-- Wann hat CAPBOY eine LOGMAN-Einheit zum ersten Mal mit Sätzen gesehen?
--
-- LOGMAN speichert das Datum einer Einheit nur, wenn man es im Log einstellt
-- oder „Diese Einheit ist vollständig → Weiter“ tippt. Ohne Datum wüsste das
-- tägliche Coaching nicht, ob heute trainiert wurde, und der Leistungsverlauf
-- hätte Lücken. Der Abgleich (Edge Function logman-abgleich) trägt deshalb je
-- Einheit „Tag|Cycle“ das Datum ein, an dem sie erstmals Sätze hatte. Da CAPBOY
-- beim Öffnen und abends abgleicht, ist das praktisch der Trainingstag. Ein
-- LOGMAN-Datum hat immer Vorrang. Einheiten, die schon vor der Kopplung
-- bestanden, bekommen null: Ihr Datum ist unbekannt.

alter table public.logman_spiegel
  add column if not exists einheiten_gesehen jsonb not null default '{}'::jsonb;
