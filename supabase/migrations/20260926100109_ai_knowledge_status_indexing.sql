-- Die Edge Function capboy-coach setzt waehrend des Aufbaus der Wissensbasis
-- den Status 'indexing' und speichert dabei die ID des neuen Vektorspeichers.
-- Die Pruefregel kannte diesen Status nicht: Das Schreiben schlug fehl, der
-- Fehler wurde nicht ausgewertet, und die ID ging verloren. Dauerte das
-- Indizieren laenger als die Wartezeit der Function, wurde beim naechsten
-- Aufruf ein weiterer Vektorspeicher angelegt, statt den laufenden
-- weiterzuverwenden.

alter table public.ai_knowledge_bases
  drop constraint if exists ai_knowledge_bases_status_check;

alter table public.ai_knowledge_bases
  add constraint ai_knowledge_bases_status_check
  check (status in ('pending', 'indexing', 'ready', 'failed'));
