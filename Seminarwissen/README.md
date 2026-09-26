# Seminar-Wissensbasis

Diese Dateien sind die kontrollierte, für `file_search` vorgesehene Fassung der
Seminarunterlagen. Die PDFs unter `Seminarunterlagen/` bleiben die maßgebliche
Quelle. Entwürfe oder OCR-Ausgaben außerhalb dieses Ordners sind keine Quelle.

## Verbindliches Format

Jedes Dokument beginnt mit YAML-Metadaten und enthält danach einen Abschnitt je
tatsächlicher PDF-Seite. Jede inhaltliche Behauptung steht in einer eigenen
Wissenseinheit:

```markdown
## PDF-Seite 1

### dokument-p001-c001

**Einstufung:** `seminar-hypothese`

**Themen:** `hautfalten`, `hormone`

**Sicherheitsmarker:** `diagnostik`

**Originalausschnitt:** „Eng zuordenbarer Ausschnitt aus der PDF-Seite.“

**Normalisierte Aussage:** Das Seminar behauptet eine bestimmte Beziehung.

**Begründung:** Die Aussage stellt einen nicht abgesicherten Zusammenhang her.

**Verwendungsgrenze:** Nicht als Diagnose oder gesicherter Kausalzusammenhang verwenden.
```

Die ID enthält die tatsächliche PDF-Seite (`p001`) und ist über alle Dateien
eindeutig. Eine Wissenseinheit darf nur eine gemeinsam einstufbare Aussage
enthalten. Gemischte Aussagen werden getrennt.

## Einstufungen

- `evidenz`: Eine grundlegende Aussage wurde zusätzlich anhand einer
  identifizierbaren, belastbaren Quelle geprüft. Das Feld `Evidenzquelle` ist
  Pflicht. Eine wissenschaftlich klingende Formulierung genügt nicht.
- `seminar-hypothese`: Das Seminar behauptet einen Zusammenhang, für den in den
  Unterlagen kein belastbarer Nachweis vorliegt. Dazu gehören insbesondere
  diagnostische Rückschlüsse von einzelnen Hautfalten auf Hormone, Organe,
  Entgiftung, Mikronährstoffmängel oder Neurotransmitter.
- `erfahrungswert`: Beobachtung, Trainerpraxis oder konkretes Vorgehen, das als
  praktische Erfahrung und nicht als gesicherter Zusammenhang dargestellt wird.

## Sicherheitsmarker

Erlaubt sind `keine`, `diagnostik`, `hormone`, `supplement`, `dosierung`,
`ernaehrung`, `training`, `schlaf`, `krankheit` und `medikament`.

Wissenseinheiten mit Sicherheitsmarker dürfen die programmatischen Grenzen des
Coachs nicht überschreiben. Insbesondere werden daraus keine Diagnosen,
Dosierungen, Medikamentenempfehlungen oder automatischen Zieländerungen.

## Normalisierung

- Rechtschreibung und offensichtliche OCR-Fehler dürfen korrigiert werden.
- Der Inhalt darf nicht erweitert oder fachlich „verbessert“ werden.
- Die normalisierte Aussage benennt zweifelhafte Inhalte ausdrücklich als
  Behauptung des Seminars.
- Zahlen, Einheiten und Grenzwerte müssen mit der sichtbaren PDF-Seite
  übereinstimmen.
- Unleserliche oder nicht sicher zuordenbare Inhalte werden nicht ergänzt,
  sondern im Prüfprotokoll als offen geführt.

## Freigabe

`manifest.json` dokumentiert pro PDF den Bearbeitungsstand. Nur Dokumente mit
Status `reviewed` dürfen später in die Wissensbasis hochgeladen werden. Vorher
müssen die lokale Schema-Prüfung, der PDF-Audit und die visuelle Prüfung aller
sicherheitsrelevanten Aussagen bestanden sein.

Tatsächlich leere PDF-Seiten werden im Manifest unter `blank_pages` aufgeführt
und im Markdown als „Leerseite im Original“ dokumentiert. Andere leere Seiten
blockieren die Freigabe.

Die lokale Prüfung läuft ohne API-Kosten:

```bash
npm run check:seminar-knowledge
```

Der aktuelle Bestand enthält bewusst keine als `evidenz` klassifizierte
Wissenseinheit: Die Seminarfolien nennen keine ausreichend identifizierbaren
Primärquellen. Das ist kein Qualitätsmangel des Audits, sondern verhindert,
dass plausibel klingende Seminarbehauptungen fälschlich als gesichert gelten.
