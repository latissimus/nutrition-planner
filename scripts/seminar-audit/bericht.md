# Audit der bereinigten Seminarunterlagen

Entwurf von Gemini gegen die Original-PDFs, erstellt am 2026-09-26T19:21:34Z. **Ungeprüfter Entwurf – nicht in die Wissensbasis übernehmen.**

Der Audit ist deterministisch: kein Sprachmodell, keine API, nichts verändert. Vergleichsgrundlage ist die OCR-Textschicht der PDFs, die selbst Fehler haben kann. Jeder Befund ist deshalb eine Stelle zum Nachsehen, kein Beweis für einen Fehler von Gemini.

- Markdown: `/Users/flrn/Desktop/Seminarunterlagen-bereinigt:` · PDFs: `Seminarunterlagen`
- Werkzeuge: Python 3.9.6, pypdf 6.14.2 · Skript 0660581b999ee4aa
- Eingaben unverändert: **ja** (SHA-256 vor und nach dem Audit)

## Überblick

| Datei | Seiten PDF/MD | Quelle | Seitenmarker | Artefakte | Zahlen (harte Fehler) | Auslassung prüfen | Einschränkungen prüfen | Fragmenthinweise | Nur visuell |
|---|---|---|---|---|---|---|---|---|---|
| Ernährung/Funktionelle Ernährung.md | 9/9 | ✗ | ✓ | 37 | 66 (10) | 8 | 3 | 8 | – |
| Ernährung/Makro:Mikronährstoffe.md | 9/9 | ✗ | ✓ | 4 | 35 (14) | 9 | 5 | 25 | – |
| Hautfalten/Hautfalten Notizen.md | 14/14 | ✗ | ✗ | 0 | 21 (0) | 5 | 3 | 14 | – |
| Hautfalten/Körperfett-Assessment.md | 17/17 | ✗ | ✓ | 343 | 103 (13) | 16 | 6 | 42 | – |
| Hautfalten/Was deine Hautfalten ueber dich aussagen.md | 2/2 | ✗ | ✓ | 0 | 1 (0) | 1 | 0 | 45 | – |
| Hormone/Hormone:Hautfaltenmessung.md | 20/20 | ✗ | ✓ | 0 | 38 (9) | 20 | 8 | 191 | – |
| Neurotransmitter/Braverman-Test.md | 1/1 | ✗ | ✓ | 3 | 40 (21) | 1 | 0 | 0 | – |
| Neurotransmitter/Neurotransmitter.md | 6/6 | ✗ | ✓ | 8 | 8 (0) | 5 | 0 | 24 | – |
| Supplements/Supplements.md | 26/26 | ✗ | ✓ | 5 | 58 (2) | 25 | 7 | 226 | 5, 7, 9, 11, 15 |

Spalten: Anzahl Befunde, bei „Auslassung“ und „Einschränkungen“ die Anzahl betroffener Seiten, bei „Fragmenthinweise“ konservative Heuristiktreffer (keine Entwarnung bei 0), bei „Nur visuell“ die PDF-Seiten ohne Textschicht.

## Befunde, die für alle Dateien gelten

- **Einstufung nur pro Seite:** 9 von 9 Dateien haben genau eine Einstufung je Seite und keine je Aussage. Eine Seite mischt aber oft belegte, hypothetische und praktische Aussagen; die geforderte Einstufung pro Abschnitt bzw. Aussage fehlt.
- **Verwendete Einstufungen:** erfahrungswert, evidenz, seminar-hypothese.

## Ernährung/Funktionelle Ernährung.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „<Ordner>/Funktionelle Ernährung.pdf“, erwartet „Ernährung/Funktionelle Ernährung.pdf“)
- **fehler:** Artefakte: fragezeichenfolge ×1, unleserlich ×36.
- Seite 1 · Abdeckung 67%
  - warnung: Nur 67% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 13 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Je loher Dopamia, desto holer-D Doka auschauen:“ · „Wohlbeﬁnden interessiert“ · „1 Dassind za starte Extreme“
  - fehler: Zahl "40g" steht nicht auf der PDF-Seite 1 und nirgends so im PDF.
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keine“ PDF 0 / MD 1, „nicht“ PDF 0 / MD 1
  - warnung: 5 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „Viel auf einmal / Wird es durch Carbs weniger? Was macht Rückenfalte? “
- Seite 2 · Abdeckung 83%
  - warnung: Nur 83% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Wear jemand won ober“ · „20% bomant cud ein Plateau“ · „wilt < so lads to curtal 8“
  - fehler: Zahl "50" steht nicht auf der PDF-Seite 2 und nirgends so im PDF.
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 3 · Abdeckung 67%
  - warnung: Nur 67% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 4 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Р Махішиш bü 140 / Maximum al Hustieg =40 Panhte“ · „der Wonhe & Valerade“ · „de bein stress heine freat,“
  - warnung: 7 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „Es gibt [unleserlich] unter der Woche. Wochenende [unleserlich] beim S“
- Seite 4 · Abdeckung 97%
  - warnung: 6 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 5 · Abdeckung 89%
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Creatin to lust Plateaus in streyth.15.07.18“
  - fehler: Zahl "15" der PDF-Seite 5 fehlt im Markdown.
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 6 · Abdeckung 81%
  - warnung: Nur 81% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Gly cogensupercompensationbased on high“ · „No taster wag to put ou“ · „HolidaSquat Honday Strengie & Mes“
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 2 mögliche Satzfragmente, z. B. „High Frequeny Training & Caloric Excess in undulating Periodization / “
- Seite 7 · Abdeckung 72%
  - warnung: Nur 72% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 10 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Tracking CHIEGO il maias in 2 cases: Uabrie-Reduction +“ · „￫ Mact es aud madad un za secsibilisiesca“ · „wichi far den algericia MendeOrthemolecular“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „manchmal“ PDF 0 / MD 1, „nicht“ PDF 0 / MD 1
  - warnung: 7 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „Cellular Health and Progress in Strength & Hypertrophy / Orthomolecula“
- Seite 8 · Abdeckung 75%
  - warnung: Nur 75% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 3 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „1. Immansgste Weun lhan“ · „2. Die leser hana es in andere Aminos encluen | Tranigsdolemen“ · „AH OUR aufnahme.“
  - fehler: Zahl "125g" steht nicht auf der PDF-Seite 8 (aber mit derselben Einheit auf einer anderen Seite des PDFs).
  - fehler: Zahl "500g" steht nicht auf der PDF-Seite 8 (aber mit derselben Einheit auf einer anderen Seite des PDFs).
  - fehler: Zahl "40g" steht nicht auf der PDF-Seite 8 und nirgends so im PDF.
  - fehler: Zahl "50g" steht nicht auf der PDF-Seite 8 (aber mit derselben Einheit auf einer anderen Seite des PDFs).
  - fehler: Zahl "4g" steht nicht auf der PDF-Seite 8 und nirgends so im PDF.
  - fehler: Zahl "60g" steht nicht auf der PDF-Seite 8 und nirgends so im PDF.
  - fehler: Zahl "5g" steht nicht auf der PDF-Seite 8 und nirgends so im PDF.
  - warnung: 20 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 3 mögliche Satzfragmente, z. B. „2. Die Leber baut es in andere Aminos um / 3. Es speichert Aminos in d“
- Seite 9 · Abdeckung 61%
  - warnung: Nur 61% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 17 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Duphetamine C i p s“ · „Strengt and Bl. The lifer“ · „Testosteron - Anabolic -D lucr.“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 0 / MD 1
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug

## Ernährung/Makro:Mikronährstoffe.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „/Makro:Mikronährstoffe.pdf“, erwartet „Ernährung/Makro:Mikronährstoffe.pdf“)
- **fehler:** Artefakte: unleserlich ×4.
- Seite 1 · Abdeckung 68%
  - warnung: Nur 68% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 23 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Relatio cabal 1 zu kompliziert umgesetzt 22.02.17“ · „￫ Zero Soja (Autindhrstotle löstrogene)“ · „Magensäure ist te luditaler, Bdass der Meusch ein Fischesser ist (Veiﬂüssigk“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 2 · Abdeckung 68%
  - warnung: Nur 68% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 14 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Kontenhydrat redaktion hann Schlal büden. 22.02.17“ · „-D Bevor es Kandwirtsceft gab, gab es heine Möglickheit hohe Kollenh.“ · „Megzu autecnelmen thi Kunde gibt es seit 10-12 Töch Jahren/in Mittlewopa“
  - fehler: Einheit bei Zahl "1" weicht ab: PDF "ohne Einheit", Markdown "g".
  - fehler: Einheit bei Zahl "18" weicht ab: PDF "ohne Einheit", Markdown "mm".
  - fehler: Zahl "8%" steht nicht auf der PDF-Seite 2 und nirgends so im PDF.
  - fehler: Zahl "4%" der PDF-Seite 2 fehlt im Markdown.
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keine“ PDF 0 / MD 1
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 2 mögliche Satzfragmente, z. B. „Rückenfalte: Genetische KH Toleranz (10 ist die Grenze) (Da es genetis“
- Seite 3 · Abdeckung 65%
  - warnung: Nur 65% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 12 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „ispr-Margarinel Bishin“ · „Sclicken die Fettsdicht“ · „3 Flutee desto weicher das se bagal“
  - fehler: Zahl "150g" steht nicht auf der PDF-Seite 3 und nirgends so im PDF.
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 5 mögliche Satzfragmente, z. B. „Fett - der meist unterschätzte Makronährstoff / 2 gute Bücher: Udo Era“
- Seite 4 · Abdeckung 71%
  - warnung: Nur 71% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Vitamia Dund 2 haben einen syuergistischen Effeld“ · „￫ Vita Nutriat Solation (Buch)“ · „Vein Mihron. hommt isoliert vorebra.“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „kein“ PDF 0 / MD 2
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 4 mögliche Satzfragmente, z. B. „Shake & Gemüse für 5 Tage (3-21 Tage) / 1-3 Esslöffel Veganes Protein“
- Seite 5 · Abdeckung 63%
  - warnung: Nur 63% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 10 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Ruchen+ Huft unter 18ua sind 22.02.17“ · „Bauch u Helfelk werken als“ · „eists steige. Führt za schankenden“
  - fehler: Einheit bei Zahl "1000" weicht ab: PDF "ohne Einheit", Markdown "kcal".
  - fehler: Einheit bei Zahl "1000" weicht ab: PDF "ohne Einheit", Markdown "kcal".
  - fehler: Zahl "18mm" steht nicht auf der PDF-Seite 5 und nirgends so im PDF.
  - fehler: Zahl "1" steht nicht auf der PDF-Seite 5 (aber mit derselben Einheit auf einer anderen Seite des PDFs).
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nur“ PDF 0 / MD 1
  - warnung: 4 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „Eine Kalorie ist nicht eine Kalorie / Funktioniert unter 1 Umstand - M“
- Seite 6 · Abdeckung 70%
  - warnung: Nur 70% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 6 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „sWenn mand hohe Hochenfalte lat+ hohe Entindepewerte“ · „und plateau beider telabrahme bat haun man 2.1. 1Noval 22.02.17“ · „DEine der ersten LosCarb Diaten.“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „kein“ PDF 0 / MD 1, „nicht“ PDF 0 / MD 1
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 2 mögliche Satzfragmente, z. B. „3 Punkte, in denen sich alle Diätbücher einig sind / 1. Iss mehr Gemüs“
- Seite 7 · Abdeckung 92%
  - pruefen: 3 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „• Tahrt zu Müdigheitn, Stimmugsschwankunge“ · „￫ Führt zb. zu NachtblindheitFas Player“ · „vou Hole von Carbs/Supps/ Proteinl“
  - fehler: Zahl "210" der PDF-Seite 7 fehlt im Markdown.
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 9 mögliche Satzfragmente, z. B. „3. Es gibt keine pflanzlichen Quellen um den B12 Bedarf zu decken (Füh“
- Seite 8 · Abdeckung 56%
  - warnung: Nur 56% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 14 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „3 Faktoren bestimmen & Proteinau Ruahme:“ · „1. Mushelmasse2. Traingolen 3 e liber, desto de Protein“ · „Je uchs Testost., desto welr Protciu)“
  - fehler: Einheit bei Zahl "3" weicht ab: PDF "ohne Einheit", Markdown "h".
  - fehler: Einheit bei Zahl "3" weicht ab: PDF "ohne Einheit", Markdown "x".
  - fehler: Zahl "4g" steht nicht auf der PDF-Seite 8 und nirgends so im PDF.
  - fehler: Zahl "2g" steht nicht auf der PDF-Seite 8 und nirgends so im PDF.
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „kein“ PDF 0 / MD 1
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 2 mögliche Satzfragmente, z. B. „3. Testosteron (Ein Mann braucht immer mehr Protein als eine Frau / Je“
- Seite 9 · Abdeckung 56%
  - warnung: Nur 56% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 3 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „DUm Bosseler zu werde: Gewese 1 freeus (Specton grasl“ · „Dynamic Greeus / Mineralien (uor allecu Magnesicia)“ · „￫Eruchruny s e l 6 s t t kreiert keinen sauren Lood.-Pess“
  - warnung: 4 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug

## Hautfalten/Hautfalten Notizen.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „/Hautfalten Notizen.pdf“, erwartet „Hautfalten/Hautfalten Notizen.pdf“)
- **fehler:** Seitenmarker außerhalb der PDF-Seiten 1–14: 236–249.
- **warnung:** Mehrere Markdown-Seiten (Positionen [1, 5]) ähneln am meisten PDF-Seite 1.
- Seite 236 (PDF-Seite 1) · Abdeckung 95%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 237 (PDF-Seite 2) · Abdeckung 97%
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „ggf“ PDF 2 / MD 1
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 238 (PDF-Seite 3) · Abdeckung 65%
  - fehler: Inhalt passt besser zu PDF-Seite 4 (0.53) als zur beanspruchten Seite 3 (0.46).
  - warnung: Nur 65% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 6 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Primär: Testrosteron-Level 1 Fehlende Rohstoffe“ · „DHEA-Level 2 Fehlende Umstände“ · „mehr DHEA für“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „ggf“ PDF 0 / MD 1
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 2 mögliche Satzfragmente, z. B. „Trizeps - Die wichtigste Falte / Generell zu behandeln wie Bauch“
- Seite 239 (PDF-Seite 4) · Abdeckung 75%
  - fehler: Inhalt passt besser zu PDF-Seite 5 (0.70) als zur beanspruchten Seite 4 (0.46).
  - warnung: Nur 75% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Zucker- / KH-Konsum“ · „Deﬁzite Mikros erhöhen“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „ggf“ PDF 1 / MD 0
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 240 (PDF-Seite 5) · Abdeckung 7%
  - fehler: Nur 7% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 9 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Korrelationen Rang Hauptfaktoren Strategien Kapitel“ · „Was machen Bauch- und“ · „Blutzucker A-H“
  - warnung: 6 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 241 (PDF-Seite 6) · Abdeckung 89%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 242 (PDF-Seite 7) · Abdeckung 96%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 243 (PDF-Seite 8) · Abdeckung 98%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 244 (PDF-Seite 9) · Abdeckung 98%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 4 mögliche Satzfragmente, z. B. „Einschlafen + Durchschlafen ist Problem / Einschlaf- & Durchschlafprob“
- Seite 245 (PDF-Seite 10) · Abdeckung 99%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 246 (PDF-Seite 11) · Abdeckung 96%
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Sekundär:Schlafdeﬁzit 2“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 5 mögliche Satzfragmente, z. B. „Besonderheiten der Beinfalten: Quadrizeps & Beinbizeps / Das Verhältni“
- Seite 247 (PDF-Seite 12) · Abdeckung 99%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „Quad+Ham+Einschlafen ist Problem / Hepatische Phase 2/Leber/Einschlafe“
- Seite 248 (PDF-Seite 13) · Abdeckung 100%
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Einschlafen/GABA-Deﬁzit“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 2 mögliche Satzfragmente, z. B. „Bauchfalte hoch + Kunde wacht aber auf & ist fit / Dann Darm/Verdauung“
- Seite 249 (PDF-Seite 14) · Abdeckung 100%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug

## Hautfalten/Körperfett-Assessment.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „/Körperfett-Assessment.pdf“, erwartet „Hautfalten/Körperfett-Assessment.pdf“)
- **warnung:** Mehrere Markdown-Seiten (Positionen [9, 10]) ähneln am meisten PDF-Seite 9.
- **warnung:** Mehrere Markdown-Seiten (Positionen [12, 15]) ähneln am meisten PDF-Seite 11.
- **fehler:** Artefakte: cite ×339, unleserlich ×4.
- Seite 1 · Abdeckung 50%
  - warnung: Nur 51% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 17 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Truchenny de Lifestyle inieteren tortehr SosculSlakul ﬂtas“ · „• Triniy & Supplements besellengen ihnChat wan jeder Ty22.02.17“ · „ements siuch trobdec notwendig in der Hibet“
  - prüfen: 2 mögliche Satzfragmente, z. B. „Es sollte immer die gleiche Person am selben Wochentag zur selben Tage“
- Seite 2 · Abdeckung 72%
  - warnung: Nur 72% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 9 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ B a s i r e u d   a u a l   t e n a l e d r“ · „fautt: Messunspielt zuischen 30 ind5%“ · „cine Rolle. Bessers Stessmanagement ISchlaf/Eruchrues“
  - warnung: 4 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 7 mögliche Satzfragmente, z. B. „Basierend auf [unleserlich] werden Ernährung & Suppl. angepasst.[cite:“
- Seite 3 · Abdeckung 64%
  - warnung: Nur 65% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „-D linke euroﬁeren“ · „Körperfelt ist zw. den“ · „siczelnen Schichten der Faszica“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „Kunde muss den Kopf leicht anheben[cite: 4] / Hier beginnt Hals![cite:“
- Seite 4 · Abdeckung 81%
  - warnung: Nur 81% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Nicht abwartenbis Zuge nacherbt!“ · „Is ﬁe terdrägt Wasser im GewebeN Von de Ticke ber au dem Puht wessen,“ · „￫ Mit 2 Fingera abmessa“
  - fehler: Einheit bei Zahl "4" weicht ab: PDF "ohne Einheit", Markdown "mm".
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 7 mögliche Satzfragmente, z. B. „Von der Seite, bei dem Punkt messen, wo der Druckpunkt der Finger[cite“
- Seite 5 · Abdeckung 82%
  - warnung: Nur 82% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 10 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Spite d. Bechens“ · „= Greuzwert = 10 Fu M/E“ · „Hinweis aul staschlechte KH-Toler.“
  - fehler: Einheit bei Zahl "10" weicht ab: PDF "ohne Einheit", Markdown "mm".
  - fehler: Einheit bei Zahl "14" weicht ab: PDF "ohne Einheit", Markdown "mm".
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 5 mögliche Satzfragmente, z. B. „Die Falte ist einen Finger breit von der Scapula entfernt, in einem 45“
- Seite 6 · Abdeckung 84%
  - warnung: Nur 84% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 7 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Jrop grileu Material zusammea schicht“ · „Kein Muskelmitélan mituehmen“ · „- Cortisol seuhen / Mikronchr-“
  - fehler: Einheit bei Zahl "8" weicht ab: PDF "ohne Einheit", Markdown "mm".
  - warnung: 4 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 4 mögliche Satzfragmente, z. B. „Direkt auf der Kniescheibe[cite: 4] / Falte auf der rechten Körperseit“
- Seite 7 · Abdeckung 85%
  - pruefen: 4 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Sagiltal = Parallel zur Korper-“ · „￫ Entgiftung der deber + Daru“ · „zu sammen diese Stotte durch deber“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keine“ PDF 1 / MD 3
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 3 mögliche Satzfragmente, z. B. „Falte auf der linken Körperseite messen[cite: 4] / Keine Norm[cite: 4]“
- Seite 8 · Abdeckung 100%
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 3 mögliche Satzfragmente, z. B. „2000 Messungen sind notwendig um Deinen Griff zu standardisieren. Und “
- Seite 9 · Abdeckung 63%
  - warnung: Nur 63% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 5 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Chrondogisch abarbeiten. Ispis. Plasel Prio=Qual-pPl22.02.1712. 2 Prio=Bauch PRa“ · „Saal Quod od. Beinb.“ · „-> Darm & Schlaf sind entscheidend“
  - warnung: 6 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 2 mögliche Satzfragmente, z. B. „YPSI Protokolle für die Hautfalten-Prioritäten[cite: 4] / Phase 1-3[ci“
- Seite 10 · Abdeckung 70%
  - fehler: Inhalt passt besser zu PDF-Seite 9 (0.40) als zur beanspruchten Seite 10 (0.28).
  - warnung: Nur 70% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 4 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Chlorenergy 3x6Vitamin D/K“ · „-> Maximierung des Energie-Levels“ · „￫> Optimierung des Stress-Managements“
  - fehler: Zahl "3" der PDF-Seite 10 fehlt im Markdown.
  - warnung: 7 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 3 mögliche Satzfragmente, z. B. „-> Darm & Schlaf sind entscheidend[cite: 4] / vs = vor dem Schlafen | “
- Seite 11 · Abdeckung 74%
  - fehler: Inhalt passt besser zu PDF-Seite 10 (0.55) als zur beanspruchten Seite 11 (0.42).
  - warnung: Nur 74% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „ChlorellaKomplex 3x3Vitamin D/K“ · „￫ Handy nicht im Schlafzimmer￫ Wiﬁ ausschalten“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 1 / MD 0
  - warnung: 5 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 3 mögliche Satzfragmente, z. B. „-> Maximierung des Energie-Levels[cite: 4] / -> Optimierung des Stress“
- Seite 12 · Abdeckung 37%
  - fehler: Inhalt passt besser zu PDF-Seite 11 (0.43) als zur beanspruchten Seite 12 (0.24).
  - fehler: Nur 37% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 12 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Entitlug lat das“ · „Speltram an Suppos“ · „Methy/Komplex -> Ham >QuadHamsQuad“
  - fehler: Zahl "80g" der PDF-Seite 12 fehlt im Markdown.
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 0 / MD 1
  - warnung: 6 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 13 · Abdeckung 37%
  - fehler: Inhalt passt besser zu PDF-Seite 12 (0.32) als zur beanspruchten Seite 13 (0.15).
  - fehler: Nur 37% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 10 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Bauch/Brust-Phase 1 bis 3“ · „Chlorella > Darm/Verdauung hat gutes PLüitatslevel, damn ist es“ · „Neuromag -> Einschlafen durch GABA Deﬁzit“
  - fehler: Zahl "20g" steht nicht auf der PDF-Seite 13 und nirgends so im PDF.
  - fehler: Zahl "80g" steht nicht auf der PDF-Seite 13 (aber mit derselben Einheit auf einer anderen Seite des PDFs).
  - warnung: 6 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 14 · Abdeckung 43%
  - fehler: Inhalt passt besser zu PDF-Seite 13 (0.44) als zur beanspruchten Seite 14 (0.19).
  - fehler: Nur 43% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „- Bp. Baud 1, Trizeps 2, Biast 3“ · „-D Wade inHomb mitPhase 4+“ · „Neuromag -> Einschlafprobleme durch GABA Deﬁzit“
  - warnung: 11 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 15 · Abdeckung 5%
  - fehler: Inhalt passt besser zu PDF-Seite 11 (0.30) als zur beanspruchten Seite 15 (0.04).
  - fehler: Nur 5% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Medizin bekannt seit 80 | Seit 2004 als BioSighature angewandt“ · „Charles Poliguin hat Konzept entwichelt“ · „ﬂurch Laborwerte+ Erfahrung“
  - fehler: Zahl "2017230" der PDF-Seite 15 fehlt im Markdown.
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keine“ PDF 2 / MD 0
  - warnung: 11 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „1. Schilddr. ist Stress (Cortisol) + Toxine[cite: 4] / Wade - Phase 1 “
- Seite 16 · Abdeckung 0%
  - fehler: Inhalt passt besser zu PDF-Seite 14 (0.43) als zur beanspruchten Seite 16 (0.01).
  - fehler: Nur 0% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Was deine Hautfalten über Dich aussagen.... Von Wolfgang Unsoeld“ · „Deine Biosignature gibt dir Aufschluss wie es in deinem Koerper aussieht. Vor al“ · „Da der Hormonhaushalt in sich integriert ist und somit jedes Hormon mit den Ande“
  - fehler: Einheit bei Zahl "4" weicht ab: PDF "mm", Markdown "ohne Einheit".
  - fehler: Einheit bei Zahl "6" weicht ab: PDF "mm", Markdown "ohne Einheit".
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „bedingt“ PDF 1 / MD 0, „kein“ PDF 1 / MD 0, „nie“ PDF 1 / MD 0, „nur“ PDF 1 / MD 0
  - warnung: 8 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 17 · Abdeckung 96%
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Bei weiteren Fragen wende Dich gerne persoenlich an mich“ · „Copyright 2010 yourpersonalstrengthcoach.com“
  - fehler: Zahl "5mm" steht nicht auf der PDF-Seite 17 (aber mit derselben Einheit auf einer anderen Seite des PDFs).
  - fehler: Zahl "10mm" (2×) steht nicht auf der PDF-Seite 17 (aber mit derselben Einheit auf einer anderen Seite des PDFs).
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „bedingt“ PDF 0 / MD 1, „kein“ PDF 0 / MD 1, „keine“ PDF 0 / MD 2, „nicht“ PDF 3 / MD 4, „nie“ PDF 0 / MD 1, „nur“ PDF 0 / MD 1
  - warnung: 10 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „Von Wolfgang Unsoeld / Deine Biosignature gibt dir Aufschluss wie es i“

## Hautfalten/Was deine Hautfalten ueber dich aussagen.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „Fitness-Coach/Was deine Hautfalten ueber dich aussagen.pdf“, erwartet „Hautfalten/Was deine Hautfalten ueber dich aussagen.pdf“)
- Seite 1 · Abdeckung 98%
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Wolfgang Unsöld    Strength Coach“
  - prüfen: 21 mögliche Satzfragmente, z. B. „Von Wolfgang Unsoeld / Deine Biosignature gibt dir Aufschluss wie es i“
- Seite 2 · Abdeckung 96%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 24 mögliche Satzfragmente, z. B. „Kohlenhydraten zurechtkommt und diese regelmaessig essen kann. Wenn je“

## Hormone/Hormone:Hautfaltenmessung.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „Hormone/Hautfaltenmessung.pdf“, erwartet „Hormone/Hormone:Hautfaltenmessung.pdf“)
- Seite 1 · Abdeckung 76%
  - warnung: Nur 76% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 4 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „= Anfangs funktioniert Ernähing+Traing. Kann spielt diesheine Rolle mohr.“ · „Entscheident dar Mashelayan“ · „SelaftAlold schlechter direstele“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 13 mögliche Satzfragmente, z. B. „funktioniert Erholung + Training wann spielt dies welche Rolle woher.“
- Seite 2 · Abdeckung 64%
  - warnung: Nur 64% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 12 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Cortial gespart. (Bauchfel ist eine Dreise die Contisol prodeeir 23.02.17“ · „DEsgibt dast nur autistise fuyen“ · „Codes Teststrad ergatio euf neuralo-“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nur“ PDF 1 / MD 0
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 17 mögliche Satzfragmente, z. B. „Regelmäßiges Essen managet den BZ-Spiegel. Dadurch wird / Cortisol ges“
- Seite 3 · Abdeckung 71%
  - warnung: Nur 71% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 6 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Erhölt man Testoskron, erholt sich“ · „automatisch Dopamia. Und augekehit.“ · „Rohe: Dopamin (cadurch wiedericu“
  - prüfen: 5 mögliche Satzfragmente, z. B. „Die Dopamin - Testosteron / Verbindung“
- Seite 4 · Abdeckung 67%
  - warnung: Nur 67% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 18 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Vor Sellafen noch ﬂas Wasser feer bessern deberjob, = Besserer“ · „Schlaft besser morgens aulachen. 23.02.17“ · „(Multi/Mag |/novitol) ￫ Gaba erhöhen luositol/Taurial“
  - fehler: Einheit bei Zahl "30" weicht ab: PDF "ohne Einheit", Markdown "min".
  - prüfen: 12 mögliche Satzfragmente, z. B. „Vor Schlafen noch Glas Wasser für besseren Leber-Job. = Besserer / Sch“
- Seite 5 · Abdeckung 86%
  - pruefen: 4 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Pﬁbt Enegie /leun aber zu“ · „￫ tatBurner erhöhen Kortisol“ · „und wirten darabes.“
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 11 mögliche Satzfragmente, z. B. „Wenn Cortisol ansteigt, sinkt Testosteron / • Immunsystem kompromitier“
- Seite 6 · Abdeckung 69%
  - warnung: Nur 69% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 13 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „dimetkusaft+Himaluyusate+Wasser war bei Morgenmüdigheit“ · „ludihator for genug Sellal ist auﬁsachen“ · „+ f l   S e i l Kurveder-meisten“
  - fehler: Einheit bei Zahl "3" weicht ab: PDF "ohne Einheit", Markdown "x".
  - fehler: Zahl "24" steht nicht auf der PDF-Seite 6 (aber mit derselben Einheit auf einer anderen Seite des PDFs).
  - fehler: Zahl "40g" steht nicht auf der PDF-Seite 6 und nirgends so im PDF.
  - fehler: Zahl "2480g" der PDF-Seite 6 fehlt im Markdown.
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 0 / MD 2
  - warnung: 6 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 12 mögliche Satzfragmente, z. B. „von Cortisol wird man leistungs- / fähiger“
- Seite 7 · Abdeckung 100%
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „•   N a c h m i t t a g s l o c h“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 2 mögliche Satzfragmente, z. B. „Physischer Effekt von chronisch / erhöhtem Cortisol - 2000“
- Seite 8 · Abdeckung 82%
  - warnung: Nur 82% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 3 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „des Cortisal Werte• Heisshunger“ · „Beeinﬂussen Cortisal“ · „Süßholzwurzelextrakt (LicoriceKomplex) (¿s UCaPFf• Inositol“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „ohne“ PDF 0 / MD 1
  - prüfen: 6 mögliche Satzfragmente, z. B. „Hoher Bedarf an Salz / Geringe Toleranz an psychischem und emotionalem“
- Seite 9 · Abdeckung 56%
  - warnung: Nur 56% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „L=Milchedior ist trokdem drin 23.02.17“ · „Pldostrou ￫ gleiches wis“ · „bei Cortisel! Niedig Caltus“
  - fehler: Einheit bei Zahl "4" weicht ab: PDF "g", Markdown "ohne Einheit".
  - fehler: Zahl "5g" steht nicht auf der PDF-Seite 9 und nirgends so im PDF.
  - fehler: Zahl "18g" steht nicht auf der PDF-Seite 9 und nirgends so im PDF.
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nur“ PDF 1 / MD 2
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 17 mögliche Satzfragmente, z. B. „Glucose / Laktosefrei = wird nur auf- / gespalten“
- Seite 10 · Abdeckung 70%
  - warnung: Nur 70% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 9 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Morgens heine Ewergie, zu uredrigerBlutdruck.“ · „Him. Sulz ist inD in fastSupermarat möglich. Daher Pu. Sctz.“ · „Ist cin cialacher Waam ein bisschen“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keine“ PDF 0 / MD 1
  - prüfen: 12 mögliche Satzfragmente, z. B. „Himalayasalz in Wasser direkt / nach dem Aufstehen mit großem“
- Seite 11 · Abdeckung 91%
  - pruefen: 3 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „5. Neurotransmitter-Domina nz“ · „B a b e d k r   B i b d l i c k   i s“ · „wichts anderes als subaptimales“
  - fehler: Einheit bei Zahl "90" weicht ab: PDF "mg", Markdown "ohne Einheit".
  - prüfen: 9 mögliche Satzfragmente, z. B. „Die 3 Faktoren, die den / Kohlenhydratbedarf bestimmen“
- Seite 12 · Abdeckung 76%
  - warnung: Nur 76% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 7 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Arginias mehr Stichoxid-mel Pump (kein Etht auf Kohlat“ · „Pbesk Wegpar webcustelende“ · „Probleme des Spinings haus“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „kein“ PDF 1 / MD 0
  - prüfen: 9 mögliche Satzfragmente, z. B. „Verbessert die Insulinsensibilität / Erhöht Adiponectin Level“
- Seite 13 · Abdeckung 68%
  - warnung: Nur 68% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 10 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Jele Fam vou Stress veruinert Schildescube (2320217“ · „=> Körpertett runter| Neistung de Ewergieteue hoch bei Schilddrüseapidbl“ · „Т4 wird beinen großen Efteht-P Bein Dal muss T4IT3 gemessen“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keinen“ PDF 0 / MD 1, „nicht“ PDF 2 / MD 4
  - warnung: 5 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 15 mögliche Satzfragmente, z. B. „Jede Form von Stress vermindert Schilddrüsenhormone / Körperfett runte“
- Seite 14 · Abdeckung 78%
  - warnung: Nur 78% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Wadenfalte (5um Maner 18un Frann)“ · „￫ Supplements bspw. li posomes“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 5 mögliche Satzfragmente, z. B. „Wird primär im Tiefschlaf und durch Sport / produziert“
- Seite 15 · Abdeckung 90%
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Th17 Sansity and“ · „T s e t r •  E a t a c i d e r  p a r s t e s“
  - prüfen: 5 mögliche Satzfragmente, z. B. „Melatonin ist das stärkste / Antioxidant des Gehirns“
- Seite 16 · Abdeckung 72%
  - warnung: Nur 72% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „-PB6 grungend vorlanden in“ · „D Optimierun von Scheat und Biorgthmas /Narmsaurerung (Serotonic“ · „ist auch für Damaktivet verantwortlida/Mug+16+1403.“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 0 / MD 1
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 10 mögliche Satzfragmente, z. B. „Vorläufer für Melatonin sind / Magnesium, B6, Inositol und“
- Seite 17 · Abdeckung 64%
  - warnung: Nur 64% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Entjithug= Leber+ Darm-Schlat 17“
- Seite 18 · Abdeckung 73%
  - warnung: Nur 73% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫(ln Brustak Freen plotelich steigt) 23.02.17“ · „￫ Nur Entründungs prozesse zu“ · „blocken (Diclof.(lbus) hilft wishts“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 6 mögliche Satzfragmente, z. B. „DIM (Konvertierung von Estradiol vermindert) / Brustfalte Fett plötzli“
- Seite 19 · Abdeckung 79%
  - warnung: Nur 79% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „MSM für Entründunge (Bspw. Sprospinatts Erteündu 23.02.17“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 5 mögliche Satzfragmente, z. B. „Botenstoffe des Nervensystems / wirken auf Hormonhaushalt und“
- Seite 20 · Abdeckung 96%
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫7 hober des Selbstvert, desto“ · „hile Helil der Hatikorper“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 20 mögliche Satzfragmente, z. B. „In mehreren Studien wurde nachgewiesen, / dass Optimismus mit einem“

## Neurotransmitter/Braverman-Test.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „/Braverman-Test.pdf“, erwartet „Neurotransmitter/Braverman-Test.pdf“)
- **fehler:** Artefakte: unleserlich ×3.
- Seite 1 · Abdeckung 7%
  - fehler: Nur 7% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 540 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Braverman Personality Type Assessment“ · „Part 1: Determining your Dominant Nature“ · „Instructions: Answer each question by selecting either True or False. Answer the“
  - fehler: Zahl "500 mg" (21×) der PDF-Seite 1 fehlt im Markdown.
  - fehler: Zahl "1000 mg" (15×) der PDF-Seite 1 fehlt im Markdown.
  - fehler: Zahl "2000 mg" (6×) der PDF-Seite 1 fehlt im Markdown.
  - fehler: Zahl "250 mg" (4×) der PDF-Seite 1 fehlt im Markdown.
  - fehler: Zahl "50 mg" (13×) der PDF-Seite 1 fehlt im Markdown.
  - fehler: Zahl "100 mg" (17×) der PDF-Seite 1 fehlt im Markdown.
  - fehler: Zahl "200 mg" (16×) der PDF-Seite 1 fehlt im Markdown.
  - fehler: Zahl "5 mg" (3×) der PDF-Seite 1 fehlt im Markdown.
  - fehler: … und 13 weitere Dosis- oder Grenzwertabweichungen (siehe bericht.json)
  - warnung: 19 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug

## Neurotransmitter/Neurotransmitter.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „Seminare/Neurotransmitter.pdf“, erwartet „Neurotransmitter/Neurotransmitter.pdf“)
- **fehler:** Artefakte: unleserlich ×8.
- Seite 1 · Abdeckung 81%
  - warnung: Nur 81% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Neurotr. Es sogt datar, dass wan Abends“ · „e n s t“ · „Kaffe ist de to actachste“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 12 mögliche Satzfragmente, z. B. „Neurotransmitter sind biochemische / Botenstoffe, die Information von “
- Seite 2 · Abdeckung 45%
  - fehler: Nur 45% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Perighares Nurisgsten (cbarte.“ · „Gestikdighert wad Kral wen“ · „Eist der eiige Aurotr. der Mustal“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 10 mögliche Satzfragmente, z. B. „Jede Form von Stimulanzien / erhöhen [unleserlich]“
- Seite 3 · Abdeckung 79%
  - warnung: Nur 79% der Wörter der PDF-Seite finden sich im Markdown.
- Seite 4 · Abdeckung 82%
  - warnung: Nur 82% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „• Alpha GPC ￫ Hauzou- Jartob“ · „• Kohlenhydrate Enlader Weg an“
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 2 mögliche Satzfragmente, z. B. „Training = weniger Ermüdung von [unleserlich] / GABA“
- Seite 5 · Abdeckung 96%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 6 · Abdeckung 86%
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „#i DopaminAcetylcholin GABA“ · „Acetylcholin GABA Serotonin7,5,3,7,5,3 5,3,1 5x6-810x5 5x510x10“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug

## Supplements/Supplements.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „Supplements.pdf“, erwartet „Supplements/Supplements.pdf“)
- **warnung:** Mehrere Markdown-Seiten (Positionen [1, 5, 7, 9, 11, 15]) ähneln am meisten PDF-Seite 1.
- **fehler:** Artefakte: unleserlich ×5.
- Seite 1 · Abdeckung 66%
  - warnung: Nur 66% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 12 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „ChlorellaKomplex 3 Mutustatt de sic an Chlorkoupl zu gwölnen“ · „Entg /Derbessert (bzgl. Nebeuw (Durchfall. /Zibrechon)“ · „dic Nülotollabsorp.lUerbessertLeber und“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 0 / MD 1, „ohne“ PDF 1 / MD 2
  - warnung: 5 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 14 mögliche Satzfragmente, z. B. „1. YPSI MultiKomplex Sind / 2. Vitamin D/K“
- Seite 2 · Abdeckung 64%
  - warnung: Nur 64% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ﬂazon Partner Programms“ · „Phase Ut Beintelteu Lusbes“ · „Nebeu. Ubelheit(Magenhränyle)“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „ggf“ PDF 0 / MD 1
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 17 mögliche Satzfragmente, z. B. „Nur das europäische Produkt (Riga) / verwenden“
- Seite 3 · Abdeckung 70%
  - warnung: Nur 70% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 9 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Tan Beintalka 3. od. 4+“ · „￫ Hat Efﬂt an Selletqualitt,“ · „weniger aul cuslafen“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 11 mögliche Satzfragmente, z. B. „2-4g vor dem Schlafen, in Kombination mit / dem YPSI Magnesium“
- Seite 4 · Abdeckung 71%
  - warnung: Nur 71% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 16 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „-/soliert nehmen nacht heinen“ · „Sp B64,12 inner zusammes“ · „TokatMethy Tetraftet NTHF“
  - warnung: 4 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 26 mögliche Satzfragmente, z. B. „PSP steht fur Pyridoxal-5-Phosphat, ener Coenzymform von / Vitamin B6 “
- Seite 5
  - pruefen: PDF-Seite 5 hat keine Textschicht (reines Bild). Inhalt nur am Seitenbild prüfbar.
  - fehler: Markdown-Seite enthält praktisch keinen Inhalt (0 Wörter ohne Platzhalter), die PDF-Seite ist ein Bild mit 1 Bildobjekt(en).
- Seite 6 · Abdeckung 69%
  - warnung: Nur 69% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 13 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Entweder teartod. Serotonia-MangeGABA“ · „• Vorstufe von GABA - Nn.1. Deﬁzit Neurotrausw. statistisch“ · „• Höchste Deﬁzite in Speed-Sportarten, da diesesehr viel Feetylcholin haben.“
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 13 mögliche Satzfragmente, z. B. „Vorstufe von GABA =  Defizit Neurotransm. statistisel / Höchste Defizi“
- Seite 7
  - pruefen: PDF-Seite 7 hat keine Textschicht (reines Bild). Inhalt nur am Seitenbild prüfbar.
  - fehler: Markdown-Seite enthält praktisch keinen Inhalt (0 Wörter ohne Platzhalter), die PDF-Seite ist ein Bild mit 1 Bildobjekt(en).
- Seite 8 · Abdeckung 83%
  - warnung: Nur 83% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „PMan lé lege Pectyle, isdem“ · „mac den lemaner lount“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 3 mögliche Satzfragmente, z. B. „Auf nüchternen Magen oder PreWo / (Acetalelolin)“
- Seite 9
  - pruefen: PDF-Seite 9 hat keine Textschicht (reines Bild). Inhalt nur am Seitenbild prüfbar.
  - fehler: Markdown-Seite enthält praktisch keinen Inhalt (0 Wörter ohne Platzhalter), die PDF-Seite ist ein Bild mit 1 Bildobjekt(en).
- Seite 10 · Abdeckung 59%
  - warnung: Nur 59% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 17 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „D Wenn te luke Hand nich sell viel schwader als“ · „-DMikroçöListoffd. (wenig selal E“ · „Ahnte Ermüdug lucig getrunke“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 1 / MD 2
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 16 mögliche Satzfragmente, z. B. „Wenn Guke Hand nicht seli viel selweder als / rechte, dann ist es ein “
- Seite 11
  - pruefen: PDF-Seite 11 hat keine Textschicht (reines Bild). Inhalt nur am Seitenbild prüfbar.
  - fehler: Markdown-Seite enthält praktisch keinen Inhalt (0 Wörter ohne Platzhalter), die PDF-Seite ist ein Bild mit 1 Bildobjekt(en).
- Seite 12 · Abdeckung 78%
  - warnung: Nur 78% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 6 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „surabig aum Fbend“ · „wenn Sellal sollet ist“ · „Wird hegestelll aus ﬂlesar.“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 15 mögliche Satzfragmente, z. B. „1,2-1,8g PWO oder vor dem Schlafen / Fördert Flussigkeits-Shift in den“
- Seite 13 · Abdeckung 63%
  - warnung: Nur 63% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Duazan com nacl Dbehauut,“ · „hana man es cber einen“ · „Pabetdiost machen, des über“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 9 mögliche Satzfragmente, z. B. „Immer zwischen den Mahlzeiten auf / nüchternen Magen“
- Seite 14 · Abdeckung 69%
  - warnung: Nur 69% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 9 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „PNelen Omege 3 cand Kerkesuia“ · „mit das beste fupp peir abate“ · „/st hera Stimulanz in Stuer“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 10 mögliche Satzfragmente, z. B. „Hauptwirkstoff ist Tetrase, ein von Harvard / patentiertes Enzym, das “
- Seite 15
  - pruefen: PDF-Seite 15 hat keine Textschicht (reines Bild). Inhalt nur am Seitenbild prüfbar.
  - fehler: Markdown-Seite enthält praktisch keinen Inhalt (0 Wörter ohne Platzhalter), die PDF-Seite ist ein Bild mit 1 Bildobjekt(en).
- Seite 16 · Abdeckung 60%
  - warnung: Nur 60% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 14 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „- c n f g p e n a l   c b e a k l s“ · „Eyder teskt beim Medie-“ · „Lest stark auf (op Bs“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 1 / MD 0
  - warnung: 4 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 12 mögliche Satzfragmente, z. B. „-P  in Saure Abban-Test / wil Solnappafos“
- Seite 17 · Abdeckung 66%
  - warnung: Nur 66% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 14 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Ascorbinsaure (Drogeñe (Apollone)“ · „weniger wan vertigt, desto besser liber 1Og airen schlect“ · „-Daher Gposomales UHS“
  - fehler: Zahl "10g" steht nicht auf der PDF-Seite 17 (aber mit derselben Einheit auf einer anderen Seite des PDFs).
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 10 mögliche Satzfragmente, z. B. „bis“
- Seite 18 · Abdeckung 60%
  - warnung: Nur 60% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 10 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „1 Kapsel zam trabstech“ · „I Für Reistenestiliphert“ · „• Spectra Gres von liniy (direkt im ves Schaload I Gut Lösung per denk de• Spect“
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 7 mögliche Satzfragmente, z. B. „Hohe Konzentration in den Mitochondrien / Rohstoff -> Cholesterin“
- Seite 19 · Abdeckung 32%
  - fehler: Nur 32% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 7 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „-elutama for Dorusaruerug“ · „bis zu 80g/Tag“ · „-Pkarhamin für ahnte Valekugen“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 2 mögliche Satzfragmente, z. B. „Glutoasa für Dorusanierung / LoVersiegelt Daramcicad“
- Seite 20 · Abdeckung 68%
  - warnung: Nur 68% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 9 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „• Oregano Öl (emulsiﬁed)“ · „Futonlide NS: Durchkalli“ · „￫ Lepsela oder PPP-Tabletta vo“
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 5 mögliche Satzfragmente, z. B. „Ideal auf Reisen und bei Erkältungen / Ideal zur Sanierung des Darm (2“
- Seite 21 · Abdeckung 41%
  - fehler: Nur 41% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 7 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫DHEPals Sapplment wird zu sluall in“ · „Östregen auleuventiert. Daler unerijaed.“ · „-D Notropilia (gruppe von Sébstanze die lngative“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 3 mögliche Satzfragmente, z. B. „→DHEA als Supplement wird zo staall in / Ostrogen ambonventiert. Daler“
- Seite 22 · Abdeckung 77%
  - warnung: Nur 77% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 5 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „metallfrei/Chin. Lat biszu biszu3% Steuer.PErlolt GreatuphoporSprdar“ · „Belaskuysgeze bis za 20sde.“ · „￫ Stagert Satelitknzellen PLtutat“
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 9 mögliche Satzfragmente, z. B. „z. B. von myprotein.com / Steigert PhosphoCreatin-Speicher“
- Seite 23 · Abdeckung 87%
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 0 / MD 1
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 4 mögliche Satzfragmente, z. B. „Primar in Verbindung mit ACh erhöhenden / Supplements nehmen“
- Seite 24 · Abdeckung 67%
  - warnung: Nur 67% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 17 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Unter 80 11 Pip ZUitD Dosieraugen basierend80-120 114 Pip auf VitD-Test“ · „VitD altiviert GCHAE was Markofagen achrüiert“ · „Labe ziel 12 im Blut. Heut“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 0 / MD 1
  - warnung: 7 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 21 mögliche Satzfragmente, z. B. „CoFactor zu Vitamin D (ideal in Kombination) / • Aktiviert Oestocalcin“
- Seite 25 · Abdeckung 70%
  - warnung: Nur 70% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „2= Nasser wit eicer Fettelicht“ · „ineur aud zutgültung gröberes Teama“ · „• Repariert cerebrales Endothelium (Gedáßcoatle der Blutgefale“
  - fehler: Zahl "10g" der PDF-Seite 25 fehlt im Markdown.
  - warnung: 5 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 13 mögliche Satzfragmente, z. B. „Für ZNS bioverfügbares Melatonin durch die / Verbindung mit Phospholip“
- Seite 26 · Abdeckung 55%
  - warnung: Nur 55% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 12 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „sTriepst. = DHEA (Rlast f. Progestron, lest., Cort., Östroge)“ · „￫ Orales DHEA funktioniert Licht!“ · „(DHER-gesamten-ludikator füu deistegsst und hncengaten“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keine“ PDF 0 / MD 1, „nicht“ PDF 0 / MD 1
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 6 mögliche Satzfragmente, z. B. „Avon 4 Hormonen bringt war / Ungleichgewicht  Man evlat Defizik der an“

## Seiten mit der geringsten Abdeckung

Anteil der Wörter der PDF-Seite, die sich im Markdown wiederfinden (mit OCR-Korrektur). Niedrige Werte heißen: Inhalt fehlt, falsche Seite – oder die Textschicht des PDFs ist so schlecht, dass der Vergleich nichts aussagt.

| Abdeckung | PDF | Seite |
|---|---|---|
| 0% | Hautfalten/Körperfett-Assessment.pdf | 16 |
| 5% | Hautfalten/Körperfett-Assessment.pdf | 15 |
| 7% | Hautfalten/Hautfalten Notizen.pdf | 5 |
| 7% | Neurotransmitter/Braverman-Test.pdf | 1 |
| 32% | Supplements/Supplements.pdf | 19 |
| 37% | Hautfalten/Körperfett-Assessment.pdf | 13 |
| 37% | Hautfalten/Körperfett-Assessment.pdf | 12 |
| 41% | Supplements/Supplements.pdf | 21 |
| 43% | Hautfalten/Körperfett-Assessment.pdf | 14 |
| 45% | Neurotransmitter/Neurotransmitter.pdf | 2 |
| 50% | Hautfalten/Körperfett-Assessment.pdf | 1 |
| 55% | Supplements/Supplements.pdf | 26 |
| 56% | Ernährung/Makro:Mikronährstoffe.pdf | 8 |
| 56% | Hormone/Hormone:Hautfaltenmessung.pdf | 9 |
| 56% | Ernährung/Makro:Mikronährstoffe.pdf | 9 |

## Deterministisch geprüft

- Seitenzahl Markdown gegen PDF, Seitenmarker (Zahl, doppelt, lückenlos, aufsteigend, im Bereich des PDFs).
- Zuordnung jeder Markdown-Seite zur ähnlichsten PDF-Seite (Wortmengen-Ähnlichkeit gegen die Textschicht).
- Doppelte Markdown-Seiten (identischer Inhalt) und PDF-Seiten ohne zugehörige Markdown-Seite.
- Artefakte und Platzhalter: [cite: …], [unleserlich], <Ordner> und andere Platzhalter in spitzen Klammern, [...], ??, Ersatz- und unsichtbare Zeichen, TODO.
- Quellenpfad in "# Quelle:" gegen den tatsächlichen Pfad des PDFs.
- Einstufung: vorhanden, erlaubter Wert, Begründung vorhanden, pro Seite oder pro Aussage.
- Zahlen als Multiset aus Wert und normalisierter Einheit gegen die Textschicht der beanspruchten PDF-Seite; Einheitenwechsel und -verlust sind harte Fehler.
- Abdeckung: Anteil der Wörter der PDF-Seite im Markdown (exakt und mit OCR-Korrektur), nicht gefundene PDF-Zeilen.
- Anzahl verneinender und einschränkender Wörter (nicht, kein, nur, ohne, möglicherweise, …) je Seite im Vergleich.
- Unverändertheit: SHA-256 aller Eingabedateien vor und nach dem Audit.

## Muss anschließend visuell oder menschlich geprüft werden

- Ob die Textschicht des PDFs selbst stimmt. Sie stammt aus einer OCR der gescannten Seiten und kann Zahlen, Einheiten und Wörter falsch enthalten. Jede Zahlenabweichung ist daher am Seitenbild zu prüfen.
- Seiten ohne Textschicht (reine Bilder): Inhalt, Vollständigkeit und Zahlen nur visuell prüfbar.
- Handschrift, Tabellen, Diagramme und Grafiken: Die Textschicht gibt Anordnung und Zuordnung von Zellen nicht zuverlässig wieder.
- Ob Negationen und Einschränkungen im Sinn erhalten sind. Der Audit zählt nur die Wörter; ob "nicht" an der richtigen Stelle steht, muss ein Mensch lesen.
- Ob die Einstufung (Evidenz, Seminar-Hypothese, Erfahrungswert) fachlich stimmt.
- Ob gemeldete Satzfragmente wirklich abgetrennt sind; auf Folien sind kurze Zeilen oft Absicht (Überschriften, Stichworte).
- Ob eine Umformulierung durch Gemini die Aussage verändert hat, auch wenn alle Wörter und Zahlen vorhanden sind.

### Konkrete PDF-Seiten zum Ansehen

Seiten mit Dosis- oder Grenzwertabweichung, fehlenden Zeilen, abweichenden Einschränkungen, fraglicher Zuordnung oder ohne Textschicht:

- Ernährung/Funktionelle Ernährung.pdf: Seiten 1, 2, 3, 5, 6, 7, 8, 9
- Ernährung/Makro:Mikronährstoffe.pdf: Seiten 1, 2, 3, 4, 5, 6, 7, 8, 9
- Hautfalten/Hautfalten Notizen.pdf: Seiten 2, 3, 4, 5, 11, 13
- Hautfalten/Körperfett-Assessment.pdf: Seiten 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17
- Hautfalten/Was deine Hautfalten ueber dich aussagen.pdf: Seiten 1
- Hormone/Hormone:Hautfaltenmessung.pdf: Seiten 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
- Neurotransmitter/Braverman-Test.pdf: Seiten 1
- Neurotransmitter/Neurotransmitter.pdf: Seiten 1, 2, 4, 6
- Supplements/Supplements.pdf: Seiten 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26

## Schwellen

- `min_zeichen_textschicht`: 20
- `min_woerter_zuordnung`: 5
- `wortlaenge_abdeckung`: 4
- `abdeckung_warnung`: 0.85
- `abdeckung_stark`: 0.5
- `aehnlichkeit_unscharf`: 0.85
- `zeile_gefunden`: 0.6
- `zeile_min_woerter`: 3

Alle Einzelheiten (Zeilennummern, Zahlen, fehlende Wörter) stehen in `bericht.json`.
