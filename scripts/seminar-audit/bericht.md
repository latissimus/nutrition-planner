# Audit der bereinigten Seminarunterlagen

Entwurf von Gemini gegen die Original-PDFs, erstellt am 2026-09-26T17:40:11Z. **Ungeprüfter Entwurf – nicht in die Wissensbasis übernehmen.**

Der Audit ist deterministisch: kein Sprachmodell, keine API, nichts verändert. Vergleichsgrundlage ist die OCR-Textschicht der PDFs, die selbst Fehler haben kann. Jeder Befund ist deshalb eine Stelle zum Nachsehen, kein Beweis für einen Fehler von Gemini.

- Markdown: `/Users/flrn/Desktop/Seminarunterlagen-bereinigt:` · PDFs: `Seminarunterlagen`
- Werkzeuge: Python 3.9.6, pypdf 6.14.2 · Skript 012ccc67edd5a297
- Eingaben unverändert: **ja** (SHA-256 vor und nach dem Audit)

## Überblick

| Datei | Seiten PDF/MD | Quelle | Seitenmarker | Artefakte | Zahlen (Dosis/Grenzwert) | Auslassung prüfen | Einschränkungen prüfen | Fragmente | Nur visuell |
|---|---|---|---|---|---|---|---|---|---|
| Ernährung/Funktionelle Ernährung.md | 9/9 | ✗ | ✓ | 37 | 53 (7) | 8 | 3 | 0 | – |
| Ernährung/Makro:Mikronährstoffe.md | 9/9 | ✗ | ✓ | 4 | 20 (7) | 9 | 5 | 0 | – |
| Hautfalten/Hautfalten Notizen.md | 14/14 | ✗ | ✗ | 0 | 20 (0) | 5 | 3 | 0 | – |
| Hautfalten/Körperfett-Assessment.md | 17/17 | ✗ | ✓ | 343 | 66 (6) | 16 | 6 | 0 | – |
| Hautfalten/Was deine Hautfalten ueber dich aussagen.md | 2/2 | ✗ | ✓ | 0 | 1 (0) | 1 | 0 | 0 | – |
| Hormone/Hormone:Hautfaltenmessung.md | 20/20 | ✗ | ✓ | 0 | 26 (4) | 20 | 8 | 14 | – |
| Neurotransmitter/Braverman-Test.md | 1/1 | ✗ | ✓ | 3 | 37 (20) | 1 | 0 | 0 | – |
| Neurotransmitter/Neurotransmitter.md | 6/6 | ✗ | ✓ | 8 | 5 (0) | 5 | 0 | 2 | – |
| Supplements/Supplements.md | 26/26 | ✗ | ✓ | 5 | 33 (2) | 25 | 7 | 10 | 5, 7, 9, 11, 15 |

Spalten: Anzahl Befunde, bei „Auslassung“ und „Einschränkungen“ die Anzahl betroffener Seiten, bei „Nur visuell“ die PDF-Seiten ohne Textschicht.

## Befunde, die für alle Dateien gelten

- **Einstufung nur pro Seite:** 9 von 9 Dateien haben genau eine Einstufung je Seite und keine je Aussage. Eine Seite mischt aber oft belegte, hypothetische und praktische Aussagen; die geforderte Einstufung pro Abschnitt bzw. Aussage fehlt.
- **Verwendete Einstufungen:** erfahrungswert, evidenz, seminar-hypothese.

## Ernährung/Funktionelle Ernährung.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „<Ordner>/Funktionelle Ernährung.pdf“, erwartet „Ernährung/Funktionelle Ernährung.pdf“)
- **fehler:** Artefakte: fragezeichenfolge ×1, unleserlich ×36.
- Seite 1 · Abdeckung 67%
  - warnung: Nur 67% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 13 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Je loher Dopamia, desto holer-D Doka auschauen:“ · „Wohlbeﬁnden interessiert“ · „1 Dassind za starte Extreme“
  - fehler: Zahl "40g" steht nicht auf PDF-Seite 1 (aber auf einer anderen Seite des PDFs).
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keine“ PDF 0 / MD 1, „nicht“ PDF 0 / MD 1
  - warnung: 5 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 2 · Abdeckung 83%
  - warnung: Nur 83% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Wear jemand won ober“ · „20% bomant cud ein Plateau“ · „wilt < so lads to curtal 8“
  - fehler: Zahl "50" steht nicht auf PDF-Seite 2 (aber auf einer anderen Seite des PDFs).
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 3 · Abdeckung 67%
  - warnung: Nur 67% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 4 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Р Махішиш bü 140 / Maximum al Hustieg =40 Panhte“ · „der Wonhe & Valerade“ · „de bein stress heine freat,“
  - warnung: 5 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 4 · Abdeckung 97%
  - warnung: 6 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 5 · Abdeckung 89%
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Creatin to lust Plateaus in streyth.15.07.18“
  - fehler: Zahl "15" der PDF-Seite fehlt im Markdown.
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 6 · Abdeckung 81%
  - warnung: Nur 81% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Gly cogensupercompensationbased on high“ · „No taster wag to put ou“ · „HolidaSquat Honday Strengie & Mes“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 7 · Abdeckung 72%
  - warnung: Nur 72% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 10 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Tracking CHIEGO il maias in 2 cases: Uabrie-Reduction +“ · „￫ Mact es aud madad un za secsibilisiesca“ · „wichi far den algericia MendeOrthemolecular“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „manchmal“ PDF 0 / MD 1, „nicht“ PDF 0 / MD 1
  - warnung: 5 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 8 · Abdeckung 75%
  - warnung: Nur 75% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 3 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „1. Immansgste Weun lhan“ · „2. Die leser hana es in andere Aminos encluen | Tranigsdolemen“ · „AH OUR aufnahme.“
  - fehler: Zahl "125g" steht nicht auf PDF-Seite 8 (aber auf einer anderen Seite des PDFs).
  - fehler: Zahl "500g" steht nicht auf PDF-Seite 8 (aber auf einer anderen Seite des PDFs).
  - fehler: Zahl "40g" steht nicht auf PDF-Seite 8 (aber auf einer anderen Seite des PDFs).
  - fehler: Zahl "60g" steht nicht auf PDF-Seite 8 und nirgends im PDF.
  - warnung: 17 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
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
- Seite 2 · Abdeckung 68%
  - warnung: Nur 68% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 14 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Kontenhydrat redaktion hann Schlal büden. 22.02.17“ · „-D Bevor es Kandwirtsceft gab, gab es heine Möglickheit hohe Kollenh.“ · „Megzu autecnelmen thi Kunde gibt es seit 10-12 Töch Jahren/in Mittlewopa“
  - fehler: Zahl "8%" steht nicht auf PDF-Seite 2 (aber auf einer anderen Seite des PDFs).
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keine“ PDF 0 / MD 1
- Seite 3 · Abdeckung 65%
  - warnung: Nur 65% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 12 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „ispr-Margarinel Bishin“ · „Sclicken die Fettsdicht“ · „3 Flutee desto weicher das se bagal“
  - fehler: Zahl "150g" steht nicht auf PDF-Seite 3 und nirgends im PDF.
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 4 · Abdeckung 71%
  - warnung: Nur 71% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Vitamia Dund 2 haben einen syuergistischen Effeld“ · „￫ Vita Nutriat Solation (Buch)“ · „Vein Mihron. hommt isoliert vorebra.“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „kein“ PDF 0 / MD 2
- Seite 5 · Abdeckung 63%
  - warnung: Nur 63% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 10 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Ruchen+ Huft unter 18ua sind 22.02.17“ · „Bauch u Helfelk werken als“ · „eists steige. Führt za schankenden“
  - fehler: Zahl "18mm" steht nicht auf PDF-Seite 5 (aber auf einer anderen Seite des PDFs).
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nur“ PDF 0 / MD 1
  - warnung: 4 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 6 · Abdeckung 70%
  - warnung: Nur 70% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 6 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „sWenn mand hohe Hochenfalte lat+ hohe Entindepewerte“ · „und plateau beider telabrahme bat haun man 2.1. 1Noval 22.02.17“ · „DEine der ersten LosCarb Diaten.“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „kein“ PDF 0 / MD 1, „nicht“ PDF 0 / MD 1
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 7 · Abdeckung 92%
  - pruefen: 3 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „• Tahrt zu Müdigheitn, Stimmugsschwankunge“ · „￫ Führt zb. zu NachtblindheitFas Player“ · „vou Hole von Carbs/Supps/ Proteinl“
  - fehler: Zahl "10" steht nicht auf PDF-Seite 7 (aber auf einer anderen Seite des PDFs).
  - fehler: Zahl "210" der PDF-Seite fehlt im Markdown.
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 8 · Abdeckung 56%
  - warnung: Nur 56% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 14 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „3 Faktoren bestimmen & Proteinau Ruahme:“ · „1. Mushelmasse2. Traingolen 3 e liber, desto de Protein“ · „Je uchs Testost., desto welr Protciu)“
  - fehler: Zahl "4g" steht nicht auf PDF-Seite 8 (aber auf einer anderen Seite des PDFs).
  - fehler: Zahl "2g" steht nicht auf PDF-Seite 8 (aber auf einer anderen Seite des PDFs).
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „kein“ PDF 0 / MD 1
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
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
- Seite 239 (PDF-Seite 4) · Abdeckung 75%
  - fehler: Inhalt passt besser zu PDF-Seite 5 (0.70) als zur beanspruchten Seite 4 (0.46).
  - warnung: Nur 75% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Zucker- / KH-Konsum“ · „Deﬁzite Mikros erhöhen“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „ggf“ PDF 1 / MD 0
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 240 (PDF-Seite 5) · Abdeckung 7%
  - fehler: Nur 7% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 9 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Korrelationen Rang Hauptfaktoren Strategien Kapitel“ · „Was machen Bauch- und“ · „Blutzucker A-H“
  - warnung: 5 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 241 (PDF-Seite 6) · Abdeckung 89%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 242 (PDF-Seite 7) · Abdeckung 96%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 243 (PDF-Seite 8) · Abdeckung 98%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 244 (PDF-Seite 9) · Abdeckung 98%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 245 (PDF-Seite 10) · Abdeckung 99%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 246 (PDF-Seite 11) · Abdeckung 96%
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Sekundär:Schlafdeﬁzit 2“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 247 (PDF-Seite 12) · Abdeckung 99%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 248 (PDF-Seite 13) · Abdeckung 100%
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Einschlafen/GABA-Deﬁzit“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
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
- Seite 2 · Abdeckung 72%
  - warnung: Nur 72% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 9 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ B a s i r e u d   a u a l   t e n a l e d r“ · „fautt: Messunspielt zuischen 30 ind5%“ · „cine Rolle. Bessers Stessmanagement ISchlaf/Eruchrues“
  - warnung: 4 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 3 · Abdeckung 64%
  - warnung: Nur 65% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „-D linke euroﬁeren“ · „Körperfelt ist zw. den“ · „siczelnen Schichten der Faszica“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 4 · Abdeckung 81%
  - warnung: Nur 81% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Nicht abwartenbis Zuge nacherbt!“ · „Is ﬁe terdrägt Wasser im GewebeN Von de Ticke ber au dem Puht wessen,“ · „￫ Mit 2 Fingera abmessa“
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 5 · Abdeckung 82%
  - warnung: Nur 82% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 10 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Spite d. Bechens“ · „= Greuzwert = 10 Fu M/E“ · „Hinweis aul staschlechte KH-Toler.“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 6 · Abdeckung 84%
  - warnung: Nur 84% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 7 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Jrop grileu Material zusammea schicht“ · „Kein Muskelmitélan mituehmen“ · „- Cortisol seuhen / Mikronchr-“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 7 · Abdeckung 85%
  - pruefen: 4 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Sagiltal = Parallel zur Korper-“ · „￫ Entgiftung der deber + Daru“ · „zu sammen diese Stotte durch deber“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keine“ PDF 1 / MD 3
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 8 · Abdeckung 100%
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 9 · Abdeckung 63%
  - warnung: Nur 63% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 5 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Chrondogisch abarbeiten. Ispis. Plasel Prio=Qual-pPl22.02.1712. 2 Prio=Bauch PRa“ · „Saal Quod od. Beinb.“ · „-> Darm & Schlaf sind entscheidend“
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 10 · Abdeckung 70%
  - fehler: Inhalt passt besser zu PDF-Seite 9 (0.40) als zur beanspruchten Seite 10 (0.28).
  - warnung: Nur 70% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 4 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Chlorenergy 3x6Vitamin D/K“ · „-> Maximierung des Energie-Levels“ · „￫> Optimierung des Stress-Managements“
  - warnung: 4 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 11 · Abdeckung 74%
  - fehler: Inhalt passt besser zu PDF-Seite 10 (0.55) als zur beanspruchten Seite 11 (0.42).
  - warnung: Nur 74% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „ChlorellaKomplex 3x3Vitamin D/K“ · „￫ Handy nicht im Schlafzimmer￫ Wiﬁ ausschalten“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 1 / MD 0
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 12 · Abdeckung 37%
  - fehler: Inhalt passt besser zu PDF-Seite 11 (0.43) als zur beanspruchten Seite 12 (0.24).
  - fehler: Nur 37% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 12 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Entitlug lat das“ · „Speltram an Suppos“ · „Methy/Komplex -> Ham >QuadHamsQuad“
  - fehler: Zahl "80g" der PDF-Seite fehlt im Markdown.
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 0 / MD 1
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 13 · Abdeckung 37%
  - fehler: Inhalt passt besser zu PDF-Seite 12 (0.32) als zur beanspruchten Seite 13 (0.15).
  - fehler: Nur 37% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 10 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Bauch/Brust-Phase 1 bis 3“ · „Chlorella > Darm/Verdauung hat gutes PLüitatslevel, damn ist es“ · „Neuromag -> Einschlafen durch GABA Deﬁzit“
  - fehler: Zahl "20g" steht nicht auf PDF-Seite 13 und nirgends im PDF.
  - fehler: Zahl "80g" steht nicht auf PDF-Seite 13 (aber auf einer anderen Seite des PDFs).
  - fehler: Zahl "3" (2×) der PDF-Seite fehlt im Markdown.
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 14 · Abdeckung 43%
  - fehler: Inhalt passt besser zu PDF-Seite 13 (0.44) als zur beanspruchten Seite 14 (0.19).
  - fehler: Nur 43% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „- Bp. Baud 1, Trizeps 2, Biast 3“ · „-D Wade inHomb mitPhase 4+“ · „Neuromag -> Einschlafprobleme durch GABA Deﬁzit“
  - warnung: 6 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 15 · Abdeckung 5%
  - fehler: Inhalt passt besser zu PDF-Seite 11 (0.30) als zur beanspruchten Seite 15 (0.04).
  - fehler: Nur 5% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Medizin bekannt seit 80 | Seit 2004 als BioSighature angewandt“ · „Charles Poliguin hat Konzept entwichelt“ · „ﬂurch Laborwerte+ Erfahrung“
  - fehler: Zahl "3" (2×) steht nicht auf PDF-Seite 15 (aber auf einer anderen Seite des PDFs).
  - fehler: Zahl "2017230" der PDF-Seite fehlt im Markdown.
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keine“ PDF 2 / MD 0
  - warnung: 10 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 16 · Abdeckung 0%
  - fehler: Inhalt passt besser zu PDF-Seite 14 (0.43) als zur beanspruchten Seite 16 (0.01).
  - fehler: Nur 0% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Was deine Hautfalten über Dich aussagen.... Von Wolfgang Unsoeld“ · „Deine Biosignature gibt dir Aufschluss wie es in deinem Koerper aussieht. Vor al“ · „Da der Hormonhaushalt in sich integriert ist und somit jedes Hormon mit den Ande“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „bedingt“ PDF 1 / MD 0, „kein“ PDF 1 / MD 0, „nie“ PDF 1 / MD 0, „nur“ PDF 1 / MD 0
  - warnung: 6 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 17 · Abdeckung 96%
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Bei weiteren Fragen wende Dich gerne persoenlich an mich“ · „Copyright 2010 yourpersonalstrengthcoach.com“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „bedingt“ PDF 0 / MD 1, „kein“ PDF 0 / MD 1, „keine“ PDF 0 / MD 2, „nicht“ PDF 3 / MD 4, „nie“ PDF 0 / MD 1, „nur“ PDF 0 / MD 1
  - warnung: 8 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug

## Hautfalten/Was deine Hautfalten ueber dich aussagen.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „Fitness-Coach/Was deine Hautfalten ueber dich aussagen.pdf“, erwartet „Hautfalten/Was deine Hautfalten ueber dich aussagen.pdf“)
- Seite 1 · Abdeckung 98%
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Wolfgang Unsöld    Strength Coach“
- Seite 2 · Abdeckung 96%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug

## Hormone/Hormone:Hautfaltenmessung.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „Hormone/Hautfaltenmessung.pdf“, erwartet „Hormone/Hormone:Hautfaltenmessung.pdf“)
- Seite 1 · Abdeckung 76%
  - warnung: Nur 76% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 4 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „= Anfangs funktioniert Ernähing+Traing. Kann spielt diesheine Rolle mohr.“ · „Entscheident dar Mashelayan“ · „SelaftAlold schlechter direstele“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „funktioniert Erholung + Training wann spielt dies welche Rolle woher.“
- Seite 2 · Abdeckung 64%
  - warnung: Nur 64% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 12 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Cortial gespart. (Bauchfel ist eine Dreise die Contisol prodeeir 23.02.17“ · „DEsgibt dast nur autistise fuyen“ · „Codes Teststrad ergatio euf neuralo-“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nur“ PDF 1 / MD 0
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „(Haben Testosteron negativ auf neuro- / logische Vorzüge)“
- Seite 3 · Abdeckung 71%
  - warnung: Nur 71% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 6 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Erhölt man Testoskron, erholt sich“ · „automatisch Dopamia. Und augekehit.“ · „Rohe: Dopamin (cadurch wiedericu“
- Seite 4 · Abdeckung 67%
  - warnung: Nur 67% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 18 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Vor Sellafen noch ﬂas Wasser feer bessern deberjob, = Besserer“ · „Schlaft besser morgens aulachen. 23.02.17“ · „(Multi/Mag |/novitol) ￫ Gaba erhöhen luositol/Taurial“
  - prüfen: 1 mögliche Satzfragmente, z. B. „Der beste Indikator für Re- / generation.“
- Seite 5 · Abdeckung 86%
  - pruefen: 4 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Pﬁbt Enegie /leun aber zu“ · „￫ tatBurner erhöhen Kortisol“ · „und wirten darabes.“
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „Fat Burner / steigert neuro- / kognitive Leistungstärke“
- Seite 6 · Abdeckung 69%
  - warnung: Nur 69% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 13 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „dimetkusaft+Himaluyusate+Wasser war bei Morgenmüdigheit“ · „ludihator for genug Sellal ist auﬁsachen“ · „+ f l   S e i l Kurveder-meisten“
  - fehler: Zahl "40g" steht nicht auf PDF-Seite 6 und nirgends im PDF.
  - fehler: Zahl "2480g" der PDF-Seite fehlt im Markdown.
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 0 / MD 2
  - warnung: 3 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „von Cortisol wird man leistungs- / fähiger“
- Seite 7 · Abdeckung 100%
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „•   N a c h m i t t a g s l o c h“
- Seite 8 · Abdeckung 82%
  - warnung: Nur 82% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 3 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „des Cortisal Werte• Heisshunger“ · „Beeinﬂussen Cortisal“ · „Süßholzwurzelextrakt (LicoriceKomplex) (¿s UCaPFf• Inositol“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „ohne“ PDF 0 / MD 1
- Seite 9 · Abdeckung 56%
  - warnung: Nur 56% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „L=Milchedior ist trokdem drin 23.02.17“ · „Pldostrou ￫ gleiches wis“ · „bei Cortisel! Niedig Caltus“
  - fehler: Zahl "5g" steht nicht auf PDF-Seite 9 (aber auf einer anderen Seite des PDFs).
  - fehler: Zahl "18g" steht nicht auf PDF-Seite 9 (aber auf einer anderen Seite des PDFs).
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nur“ PDF 1 / MD 2
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 5 mögliche Satzfragmente, z. B. „Glucose / Laktosefrei = wird nur auf- / gespalten“
- Seite 10 · Abdeckung 70%
  - warnung: Nur 70% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 9 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Morgens heine Ewergie, zu uredrigerBlutdruck.“ · „Him. Sulz ist inD in fastSupermarat möglich. Daher Pu. Sctz.“ · „Ist cin cialacher Waam ein bisschen“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keine“ PDF 0 / MD 1
  - prüfen: 1 mögliche Satzfragmente, z. B. „Insulin ist nicht leistungs- / steigernd“
- Seite 11 · Abdeckung 91%
  - pruefen: 3 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „5. Neurotransmitter-Domina nz“ · „B a b e d k r   B i b d l i c k   i s“ · „wichts anderes als subaptimales“
  - prüfen: 1 mögliche Satzfragmente, z. B. „Rippenfalte ist auch Indikator für ent- / zündungsweite“
- Seite 12 · Abdeckung 76%
  - warnung: Nur 76% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 7 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Arginias mehr Stichoxid-mel Pump (kein Etht auf Kohlat“ · „Pbesk Wegpar webcustelende“ · „Probleme des Spinings haus“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „kein“ PDF 1 / MD 0
  - prüfen: 1 mögliche Satzfragmente, z. B. „Der Wechsel dieser beiden Zu- / stände ist zwingend notwendig.“
- Seite 13 · Abdeckung 68%
  - warnung: Nur 68% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 10 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Jele Fam vou Stress veruinert Schildescube (2320217“ · „=> Körpertett runter| Neistung de Ewergieteue hoch bei Schilddrüseapidbl“ · „Т4 wird beinen großen Efteht-P Bein Dal muss T4IT3 gemessen“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keinen“ PDF 0 / MD 1, „nicht“ PDF 2 / MD 4
  - warnung: 4 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 14 · Abdeckung 78%
  - warnung: Nur 78% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Wadenfalte (5um Maner 18un Frann)“ · „￫ Supplements bspw. li posomes“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 15 · Abdeckung 90%
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Th17 Sansity and“ · „T s e t r •  E a t a c i d e r  p a r s t e s“
- Seite 16 · Abdeckung 72%
  - warnung: Nur 72% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „-PB6 grungend vorlanden in“ · „D Optimierun von Scheat und Biorgthmas /Narmsaurerung (Serotonic“ · „ist auch für Damaktivet verantwortlida/Mug+16+1403.“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 0 / MD 1
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 17 · Abdeckung 64%
  - warnung: Nur 64% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Entjithug= Leber+ Darm-Schlat 17“
- Seite 18 · Abdeckung 73%
  - warnung: Nur 73% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫(ln Brustak Freen plotelich steigt) 23.02.17“ · „￫ Nur Entründungs prozesse zu“ · „blocken (Diclof.(lbus) hilft wishts“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 19 · Abdeckung 79%
  - warnung: Nur 79% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 1 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „MSM für Entründunge (Bspw. Sprospinatts Erteündu 23.02.17“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 20 · Abdeckung 96%
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫7 hober des Selbstvert, desto“ · „hile Helil der Hatikorper“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „langsameren Krankheitsverlauf bei HIV- / positiven Patienten einhergeh“

## Neurotransmitter/Braverman-Test.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „/Braverman-Test.pdf“, erwartet „Neurotransmitter/Braverman-Test.pdf“)
- **fehler:** Artefakte: unleserlich ×3.
- Seite 1 · Abdeckung 7%
  - fehler: Nur 7% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 540 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Braverman Personality Type Assessment“ · „Part 1: Determining your Dominant Nature“ · „Instructions: Answer each question by selecting either True or False. Answer the“
  - fehler: Zahl "500 mg" (21×) der PDF-Seite fehlt im Markdown.
  - fehler: Zahl "1000 mg" (15×) der PDF-Seite fehlt im Markdown.
  - fehler: Zahl "2000 mg" (6×) der PDF-Seite fehlt im Markdown.
  - fehler: Zahl "250 mg" (4×) der PDF-Seite fehlt im Markdown.
  - fehler: Zahl "50 mg" (13×) der PDF-Seite fehlt im Markdown.
  - fehler: Zahl "100 mg" (17×) der PDF-Seite fehlt im Markdown.
  - fehler: Zahl "200 mg" (16×) der PDF-Seite fehlt im Markdown.
  - fehler: Zahl "5 mg" (3×) der PDF-Seite fehlt im Markdown.
  - fehler: … und 12 weitere Dosis- oder Grenzwertabweichungen (siehe bericht.json)
  - warnung: 17 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug

## Neurotransmitter/Neurotransmitter.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „Seminare/Neurotransmitter.pdf“, erwartet „Neurotransmitter/Neurotransmitter.pdf“)
- **fehler:** Artefakte: unleserlich ×8.
- Seite 1 · Abdeckung 81%
  - warnung: Nur 81% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Neurotr. Es sogt datar, dass wan Abends“ · „e n s t“ · „Kaffe ist de to actachste“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „Phenyl- / alanin“
- Seite 2 · Abdeckung 45%
  - fehler: Nur 45% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Perighares Nurisgsten (cbarte.“ · „Gestikdighert wad Kral wen“ · „Eist der eiige Aurotr. der Mustal“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „Ist der einzige Neurotr. der Muskel- / fasern kontraktieren kann.“
- Seite 3 · Abdeckung 79%
  - warnung: Nur 79% der Wörter der PDF-Seite finden sich im Markdown.
- Seite 4 · Abdeckung 82%
  - warnung: Nur 82% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „• Alpha GPC ￫ Hauzou- Jartob“ · „• Kohlenhydrate Enlader Weg an“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 5 · Abdeckung 96%
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 6 · Abdeckung 86%
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „#i DopaminAcetylcholin GABA“ · „Acetylcholin GABA Serotonin7,5,3,7,5,3 5,3,1 5x6-810x5 5x510x10“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug

## Supplements/Supplements.md

- **fehler:** Quellenpfad passt nicht zum tatsächlichen PDF. (gefunden „Supplements.pdf“, erwartet „Supplements/Supplements.pdf“)
- **warnung:** Mehrere Markdown-Seiten (Positionen [1, 5, 7, 9, 11, 15]) ähneln am meisten PDF-Seite 1.
- **fehler:** Artefakte: unleserlich ×5.
- Seite 1 · Abdeckung 66%
  - warnung: Nur 66% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 12 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „ChlorellaKomplex 3 Mutustatt de sic an Chlorkoupl zu gwölnen“ · „Entg /Derbessert (bzgl. Nebeuw (Durchfall. /Zibrechon)“ · „dic Nülotollabsorp.lUerbessertLeber und“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 0 / MD 1, „ohne“ PDF 1 / MD 2
- Seite 2 · Abdeckung 64%
  - warnung: Nur 64% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ﬂazon Partner Programms“ · „Phase Ut Beintelteu Lusbes“ · „Nebeu. Ubelheit(Magenhränyle)“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „ggf“ PDF 0 / MD 1
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 3 · Abdeckung 70%
  - warnung: Nur 70% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 9 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫ Tan Beintalka 3. od. 4+“ · „￫ Hat Efﬂt an Selletqualitt,“ · „weniger aul cuslafen“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 4 · Abdeckung 71%
  - warnung: Nur 71% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 16 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „-/soliert nehmen nacht heinen“ · „Sp B64,12 inner zusammes“ · „TokatMethy Tetraftet NTHF“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 3 mögliche Satzfragmente, z. B. „Myoglobin), Energiestoffwechsel in Mitochondrien (PSP- / abhängige Syn“
- Seite 5
  - pruefen: PDF-Seite 5 hat keine Textschicht (reines Bild). Inhalt nur am Seitenbild prüfbar.
  - fehler: Markdown-Seite enthält praktisch keinen Inhalt (0 Wörter ohne Platzhalter), die PDF-Seite ist ein Bild mit 1 Bildobjekt(en).
- Seite 6 · Abdeckung 69%
  - warnung: Nur 69% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 13 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Entweder teartod. Serotonia-MangeGABA“ · „• Vorstufe von GABA - Nn.1. Deﬁzit Neurotrausw. statistisch“ · „• Höchste Deﬁzite in Speed-Sportarten, da diesesehr viel Feetylcholin haben.“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „bis zu 1 Woche als anti- / bohterielles   tel“
- Seite 7
  - pruefen: PDF-Seite 7 hat keine Textschicht (reines Bild). Inhalt nur am Seitenbild prüfbar.
  - fehler: Markdown-Seite enthält praktisch keinen Inhalt (0 Wörter ohne Platzhalter), die PDF-Seite ist ein Bild mit 1 Bildobjekt(en).
- Seite 8 · Abdeckung 83%
  - warnung: Nur 83% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 2 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „PMan lé lege Pectyle, isdem“ · „mac den lemaner lount“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 9
  - pruefen: PDF-Seite 9 hat keine Textschicht (reines Bild). Inhalt nur am Seitenbild prüfbar.
  - fehler: Markdown-Seite enthält praktisch keinen Inhalt (0 Wörter ohne Platzhalter), die PDF-Seite ist ein Bild mit 1 Bildobjekt(en).
- Seite 10 · Abdeckung 59%
  - warnung: Nur 59% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 17 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „D Wenn te luke Hand nich sell viel schwader als“ · „-DMikroçöListoffd. (wenig selal E“ · „Ahnte Ermüdug lucig getrunke“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 1 / MD 2
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 11
  - pruefen: PDF-Seite 11 hat keine Textschicht (reines Bild). Inhalt nur am Seitenbild prüfbar.
  - fehler: Markdown-Seite enthält praktisch keinen Inhalt (0 Wörter ohne Platzhalter), die PDF-Seite ist ein Bild mit 1 Bildobjekt(en).
- Seite 12 · Abdeckung 78%
  - warnung: Nur 78% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 6 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „surabig aum Fbend“ · „wenn Sellal sollet ist“ · „Wird hegestelll aus ﬂlesar.“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 2 mögliche Satzfragmente, z. B. „-Wind hergestellt aus lock- / abfallen. Nicht aus parem Riad-“
- Seite 13 · Abdeckung 63%
  - warnung: Nur 63% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 8 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Duazan com nacl Dbehauut,“ · „hana man es cber einen“ · „Pabetdiost machen, des über“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 14 · Abdeckung 69%
  - warnung: Nur 69% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 9 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „PNelen Omege 3 cand Kerkesuia“ · „mit das beste fupp peir abate“ · „/st hera Stimulanz in Stuer“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 15
  - pruefen: PDF-Seite 15 hat keine Textschicht (reines Bild). Inhalt nur am Seitenbild prüfbar.
  - fehler: Markdown-Seite enthält praktisch keinen Inhalt (0 Wörter ohne Platzhalter), die PDF-Seite ist ein Bild mit 1 Bildobjekt(en).
- Seite 16 · Abdeckung 60%
  - warnung: Nur 60% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 14 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „- c n f g p e n a l   c b e a k l s“ · „Eyder teskt beim Medie-“ · „Lest stark auf (op Bs“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 1 / MD 0
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 17 · Abdeckung 66%
  - warnung: Nur 66% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 14 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Ascorbinsaure (Drogeñe (Apollone)“ · „weniger wan vertigt, desto besser liber 1Og airen schlect“ · „-Daher Gposomales UHS“
  - fehler: Zahl "10g" steht nicht auf PDF-Seite 17 (aber auf einer anderen Seite des PDFs).
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „bis“
- Seite 18 · Abdeckung 60%
  - warnung: Nur 60% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 10 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „1 Kapsel zam trabstech“ · „I Für Reistenestiliphert“ · „• Spectra Gres von liniy (direkt im ves Schaload I Gut Lösung per denk de• Spect“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 19 · Abdeckung 32%
  - fehler: Nur 32% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 7 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „-elutama for Dorusaruerug“ · „bis zu 80g/Tag“ · „-Pkarhamin für ahnte Valekugen“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „bis za $3\times3$“
- Seite 20 · Abdeckung 68%
  - warnung: Nur 68% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 9 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „• Oregano Öl (emulsiﬁed)“ · „Futonlide NS: Durchkalli“ · „￫ Lepsela oder PPP-Tabletta vo“
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 21 · Abdeckung 41%
  - fehler: Nur 41% der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.
  - pruefen: 7 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „￫DHEPals Sapplment wird zu sluall in“ · „Östregen auleuventiert. Daler unerijaed.“ · „-D Notropilia (gruppe von Sébstanze die lngative“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 22 · Abdeckung 77%
  - warnung: Nur 77% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 5 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „metallfrei/Chin. Lat biszu biszu3% Steuer.PErlolt GreatuphoporSprdar“ · „Belaskuysgeze bis za 20sde.“ · „￫ Stagert Satelitknzellen PLtutat“
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „-P Exhars Creapare selwer- / metallifeci Chin. Rat bis zu 3ta Sclavem“
- Seite 23 · Abdeckung 87%
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 0 / MD 1
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 24 · Abdeckung 67%
  - warnung: Nur 67% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 17 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „Unter 80 11 Pip ZUitD Dosieraugen basierend80-120 114 Pip auf VitD-Test“ · „VitD altiviert GCHAE was Markofagen achrüiert“ · „Labe ziel 12 im Blut. Heut“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „nicht“ PDF 0 / MD 1
  - warnung: 5 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
  - prüfen: 1 mögliche Satzfragmente, z. B. „CD Ist aber troeder als FCH- / burner houpikett warkos“
- Seite 25 · Abdeckung 70%
  - warnung: Nur 70% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 11 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „2= Nasser wit eicer Fettelicht“ · „ineur aud zutgültung gröberes Teama“ · „• Repariert cerebrales Endothelium (Gedáßcoatle der Blutgefale“
  - fehler: Zahl "10g" der PDF-Seite fehlt im Markdown.
  - warnung: 2 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug
- Seite 26 · Abdeckung 55%
  - warnung: Nur 55% der Wörter der PDF-Seite finden sich im Markdown.
  - pruefen: 12 Zeile(n) der PDF-Seite nicht im Markdown gefunden. Beispiele: „sTriepst. = DHEA (Rlast f. Progestron, lest., Cort., Östroge)“ · „￫ Orales DHEA funktioniert Licht!“ · „(DHER-gesamten-ludikator füu deistegsst und hncengaten“
  - pruefen: Anzahl verneinender oder einschränkender Wörter weicht ab. „keine“ PDF 0 / MD 1, „nicht“ PDF 0 / MD 1
  - warnung: 1 weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug

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
- Zahlen mit Einheit gegen die Textschicht der beanspruchten PDF-Seite, in beide Richtungen; Dosis- und Grenzwertangaben getrennt ausgewiesen.
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
