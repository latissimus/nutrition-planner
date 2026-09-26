"""Deterministischer Audit der bereinigten Seminarunterlagen (Schritt 3, Vorbereitung).

Vergleicht Geminis Markdown-Entwürfe mit den Original-PDFs, ohne Sprachmodell,
ohne API und ohne irgendetwas zu verändern:

    python3 scripts/seminar-audit/audit.py
    python3 scripts/seminar-audit/audit.py --md "<Ordner mit .md>" --pdf Seminarunterlagen

Ergebnis: scripts/seminar-audit/bericht.json (maschinenlesbar) und
scripts/seminar-audit/bericht.md (lesbar).

Grundlage des Vergleichs ist die Textschicht der PDFs. Die PDFs sind gescannte
Seiten mit OCR-Text; diese Textschicht kann selbst falsch sein. Jede
Abweichung ist deshalb ein Hinweis auf eine Stelle, die jemand an der
PDF-Seite selbst ansehen muss - kein Beweis, dass Gemini falsch liegt.
"""

import argparse
from collections import Counter
import difflib
import hashlib
import json
import logging
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pypdf
from pypdf import PdfReader

logging.getLogger('pypdf').setLevel(logging.ERROR)

HIER = Path(__file__).resolve().parent
REPO = HIER.parent.parent
STANDARD_MD = Path('/Users/flrn/Desktop/Seminarunterlagen-bereinigt:')
STANDARD_PDF = REPO / 'Seminarunterlagen'
ERWARTETE_PYPDF_VERSION = '6.14.2'

# Schwellen. Bewusst einfach gehalten und im Bericht ausgewiesen.
SCHWELLEN = {
    'min_zeichen_textschicht': 20,     # darunter gilt eine PDF-Seite als ohne Text
    'min_woerter_zuordnung': 5,        # darunter ist eine Seite nicht zuordenbar
    'wortlaenge_abdeckung': 4,         # nur Wörter ab dieser Länge zählen für die Abdeckung
    'abdeckung_warnung': 0.85,         # Anteil der PDF-Wörter, die im Markdown vorkommen
    'abdeckung_stark': 0.5,            # darunter: vermutlich Inhalt ausgelassen oder falsche Seite
    'aehnlichkeit_unscharf': 0.85,     # difflib-Verhältnis für OCR-Korrekturen
    'zeile_gefunden': 0.6,             # Anteil der Wörter einer PDF-Zeile im Markdown
    'zeile_min_woerter': 3,
}

EINSTUFUNGEN = {'evidenz', 'seminar-hypothese', 'erfahrungswert'}

# Artefakte, die in einer bereinigten Fassung nicht stehen dürfen.
ARTEFAKTE = [
    ('cite', re.compile(r'\[cite[^\]]*\]', re.I)),
    ('unleserlich', re.compile(r'\[unleserlich[^\]]*\]', re.I)),
    ('platzhalter_spitz', re.compile(r'<(?!!--)(?!/?(?:br|sup|sub|b|i|u)\b)[A-Za-zÄÖÜäöüß][^<>\n]{0,40}>')),
    ('auslassung_klammer', re.compile(r'\[(?:\.\.\.|…|\?)\]')),
    ('fragezeichenfolge', re.compile(r'\?{2,}')),
    ('ersatzzeichen', re.compile('\\ufffd')),
    ('unsichtbare_zeichen', re.compile('[\\u200b\\u200c\\u200d\\u2060\\ufeff]')),
    ('todo', re.compile(r'\b(?:TODO|FIXME|XXX)\b')),
]

# Wörter, deren Verlust oder Hinzufügen die Bedeutung umkehren oder abschwächen
# kann. Ein reiner Zahlenvergleich sieht das nicht.
EINSCHRAENKUNGEN = [
    'nicht', 'kein', 'keine', 'keinen', 'keinem', 'keiner', 'keines', 'nie', 'niemals', 'ohne',
    'nur', 'kaum', 'selten', 'möglicherweise', 'eventuell', 'evtl', 'vielleicht', 'ggf',
    'gegebenenfalls', 'eher', 'bedingt', 'manchmal', 'teilweise',
]

EINHEITEN = [
    'mg', 'µg', 'μg', 'mcg', 'ug', 'g', 'kg', 'ie', 'i.e.', 'iu', 'ml', 'l', 'µmol', 'μmol', 'mmol',
    'nmol', 'pmol', 'ng', 'pg', '%', 'kcal', 'mm', 'cm', 'm', '°c', 'h', 'min', 'std', 'tage', 'tag',
    'wochen', 'woche', 'monate', 'jahre', 'x',
]
DOSIS_EINHEITEN = {'mg', 'µg', 'μg', 'mcg', 'ug', 'g', 'ie', 'i.e.', 'iu', 'ml', 'µmol', 'μmol', 'mmol', 'nmol', 'pmol', 'ng', 'pg'}
GRENZ_WOERTER = re.compile(r'(?:<|>|≤|≥|unter|über|bis|max\.?|maximal|mind\.?|mindestens|ab)\s*$', re.I)
ZAHL = re.compile(
    r'(?<![\w.,])([-−+]?\d+(?:[.,]\d+)*)\s?('
    + '|'.join(sorted((re.escape(e) for e in EINHEITEN), key=len, reverse=True))
    + r')?(?![\w])',
    re.I,
)

FUELLWOERTER_ENDE = {'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'mit', 'zu', 'zum',
                     'zur', 'von', 'vom', 'für', 'bei', 'auf', 'in', 'im', 'an', 'am', 'als', 'wie', 'dass', 'wenn', 'weil'}
KONJUNKTIONEN_NACH_TRENNSTRICH = {'oder', 'und', 'bzw', 'bis', 'sowie'}
EINHEIT_ALIASE = {
    'μg': 'µg', 'ug': 'µg', 'mcg': 'µg',
    'μmol': 'µmol',
    'i.e.': 'ie', 'iu': 'ie',
    'std': 'h',
    'tage': 'tag', 'wochen': 'woche', 'monate': 'monat', 'jahre': 'jahr',
}
SATZENDE = re.compile(r'[.!?;:](?:[)\]"\u201c\u201d\u00bb]*)$')
PROSA_SIGNAL = {
    'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'hat', 'haben', 'kann', 'können',
    'die', 'der', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einen',
    'von', 'mit', 'für', 'auf', 'in', 'an', 'zu', 'dass', 'wenn', 'weil', 'damit',
}


def sha256(pfad):
    return hashlib.sha256(Path(pfad).read_bytes()).hexdigest()


def nfc(text):
    return unicodedata.normalize('NFC', text)


def woerter(text):
    """Kleingeschriebene Wörter; Zeilentrennungen mit Bindestrich werden zusätzlich zusammengezogen."""
    text = nfc(text).lower()
    zusammen = re.sub(r'(\w)-\s*\n\s*(\w)', r'\1\2', text)
    liste = re.findall(r'[a-zäöüß0-9]+', zusammen)
    return liste


def zahlen(text):
    """Zahlen mit optionaler Einheit, normalisiert (Komma = Punkt, Unicode-Minus = Minus)."""
    gefunden = []
    for treffer in ZAHL.finditer(nfc(text)):
        roh, einheit = treffer.group(1), (treffer.group(2) or '').lower()
        wert = roh.replace('−', '-').replace(',', '.')
        vorher = text[max(0, treffer.start() - 12):treffer.start()]
        einheit = einheit.replace('μ', 'µ')
        einheit = EINHEIT_ALIASE.get(einheit, einheit)
        gefunden.append({
            'roh': treffer.group(0).strip(),
            'wert': wert.lstrip('+'),
            'einheit': einheit,
            'dosis': einheit in {EINHEIT_ALIASE.get(e.replace('μ', 'µ'), e.replace('μ', 'µ')) for e in DOSIS_EINHEITEN},
            'grenzwert': bool(GRENZ_WOERTER.search(vorher)),
        })
    return gefunden


def gruppiert(liste):
    """Gleiche Zahlen (Wert, Einheit, Dosis/Grenzwert) zusammenfassen, Reihenfolge des ersten Auftretens."""
    gruppen = {}
    for z in liste:
        schluessel = (z['wert'], z['einheit'], z['dosis'], z['grenzwert'])
        if schluessel in gruppen:
            gruppen[schluessel][1] += 1
        else:
            gruppen[schluessel] = [z, 1]
    return [(z, anzahl) for z, anzahl in gruppen.values()]


def zahlenabweichungen(pdf_text, md_text, alle_pdf_text=''):
    """Vergleicht Zahlen als Multiset aus Wert und normalisierter Einheit.

    Gleiche Werte mit anderer oder fehlender Einheit werden als harter
    Einheitenfehler gepaart, bevor verbleibende Zahlen als fehlend/zusätzlich
    gemeldet werden. So bleiben auch unterschiedliche Häufigkeiten sichtbar.
    """
    pdf_z = zahlen(pdf_text)
    md_z = zahlen(ohne_artefakte(md_text))
    pdf_paare = Counter((z['wert'], z['einheit']) for z in pdf_z)
    md_paare = Counter((z['wert'], z['einheit']) for z in md_z)
    gemeinsam = pdf_paare & md_paare
    pdf_rest = pdf_paare - gemeinsam
    md_rest = md_paare - gemeinsam
    befunde = []

    # Gleicher Wert, aber andere/fehlende Einheit: nicht als zwei unabhängige
    # Zahlenfehler ausgeben, sondern als eindeutigen Einheitenfehler.
    for wert in sorted({w for w, _ in pdf_rest} & {w for w, _ in md_rest}):
        pdf_einheiten = sorted(e for (w, e), n in pdf_rest.items() if w == wert for _ in range(n))
        md_einheiten = sorted(e for (w, e), n in md_rest.items() if w == wert for _ in range(n))
        for pdf_einheit, md_einheit in zip(pdf_einheiten, md_einheiten):
            pdf_rest[(wert, pdf_einheit)] -= 1
            md_rest[(wert, md_einheit)] -= 1
            befunde.append(befund(
                'zahl', 'fehler',
                f'Einheit bei Zahl "{wert}" weicht ab: PDF "{pdf_einheit or "ohne Einheit"}", Markdown "{md_einheit or "ohne Einheit"}".',
                grund='einheitenabweichung', wert=wert,
                pdf_einheit=pdf_einheit, markdown_einheit=md_einheit,
            ))
    pdf_rest += Counter()
    md_rest += Counter()

    alle_pdf_paare = Counter((z['wert'], z['einheit']) for z in zahlen(alle_pdf_text or pdf_text))
    beispiel_md = {(z['wert'], z['einheit']): z for z in md_z}
    beispiel_pdf = {(z['wert'], z['einheit']): z for z in pdf_z}
    for paar, anzahl in md_rest.items():
        z = beispiel_md[paar]
        anderswo = alle_pdf_paare[paar] > 0
        schwere = 'fehler' if (z['dosis'] or z['grenzwert']) else 'warnung'
        befunde.append(befund(
            'zahl', schwere,
            f'Zahl "{z["roh"]}"{mal(anzahl)} steht nicht auf der PDF-Seite'
            + (' (aber mit derselben Einheit auf einer anderen Seite des PDFs).' if anderswo else ' und nirgends so im PDF.'),
            grund='nur_markdown', richtung='nur_markdown', zahl=z,
            anzahl=anzahl, anderswo_im_pdf=anderswo,
        ))
    for paar, anzahl in pdf_rest.items():
        z = beispiel_pdf[paar]
        schwere = 'fehler' if (z['dosis'] or z['grenzwert']) else 'warnung'
        befunde.append(befund(
            'zahl', schwere,
            f'Zahl "{z["roh"]}"{mal(anzahl)} der PDF-Seite fehlt im Markdown.',
            grund='nur_pdf', richtung='nur_pdf', zahl=z, anzahl=anzahl,
        ))
    return befunde, md_z


def mal(anzahl):
    return f' ({anzahl}×)' if anzahl > 1 else ''


def ohne_artefakte(text):
    for _, muster in ARTEFAKTE:
        text = muster.sub(' ', text)
    return text


def einschraenkungen(text):
    liste = woerter(text)
    return {wort: liste.count(wort) for wort in EINSCHRAENKUNGEN if liste.count(wort)}


# --------------------------------------------------------------------------
# Einlesen
# --------------------------------------------------------------------------

# Der Wert selbst kann einen Bindestrich enthalten ("seminar-hypothese"),
# deshalb trennen nur Gedankenstrich, Halbgeviertstrich oder "--".
EINSTUFUNG = re.compile(r'<!--\s*einstufung:\s*(\S+?)\s*(?:—|–|--)\s*begründung:\s*(.*?)\s*-->', re.I | re.S)
EINSTUFUNG_ROH = re.compile(r'<!--\s*einstufung', re.I)
KOMMENTAR = re.compile(r'<!--.*?-->', re.S)
INLINE_EINSTUFUNG = re.compile(r'\[(?:evidenz|seminar-hypothese|erfahrungswert)\]', re.I)


def lies_markdown(pfad):
    zeilen = nfc(Path(pfad).read_text(encoding='utf-8')).split('\n')
    quelle = None
    seiten = []
    aktuell = None
    for nummer, zeile in enumerate(zeilen, start=1):
        if quelle is None and zeile.startswith('# Quelle:'):
            quelle = zeile[len('# Quelle:'):].strip()
            continue
        kopf = re.match(r'^##\s+Seite\s+(\S+)\s*$', zeile)
        if kopf:
            aktuell = {'marker': kopf.group(1), 'zeile': nummer, 'zeilen': []}
            seiten.append(aktuell)
            continue
        if aktuell is not None:
            aktuell['zeilen'].append((nummer, zeile))
    for seite in seiten:
        roh = '\n'.join(zeile for _, zeile in seite['zeilen'])
        seite['roh'] = roh
        seite['einstufungen'] = [{'wert': w.strip().lower(), 'begruendung': b.strip()} for w, b in EINSTUFUNG.findall(roh)]
        seite['einstufungen_unlesbar'] = len(EINSTUFUNG_ROH.findall(roh)) - len(seite['einstufungen'])
        seite['inline_einstufungen'] = len(INLINE_EINSTUFUNG.findall(KOMMENTAR.sub('', roh)))
        seite['text'] = markdown_zu_text(roh)
    return {'quelle': quelle, 'seiten': seiten, 'zeilen_gesamt': len(zeilen)}


def markdown_zu_text(roh):
    """Nur der Inhalt: ohne Kommentare, Tabellen-Trenner und Markdown-Zeichen."""
    text = KOMMENTAR.sub('', roh)
    zeilen = []
    for zeile in text.split('\n'):
        if re.match(r'^\s*\|?\s*:?-{3,}', zeile):
            continue
        zeile = re.sub(r'^\s*#{1,6}\s+', '', zeile)
        zeile = re.sub(r'^\s*[-*+]\s+', '', zeile)
        zeile = zeile.replace('|', ' ').replace('**', '').replace('__', '')
        zeilen.append(zeile)
    return '\n'.join(zeilen)


def lies_pdf(pfad):
    leser = PdfReader(str(pfad))
    seiten = []
    for index, seite in enumerate(leser.pages):
        text = nfc(seite.extract_text() or '')
        try:
            bilder = len(seite.images)
        except Exception:  # noqa: BLE001 - defekte Bildobjekte zählen als unbekannt
            bilder = None
        try:
            label = leser.page_labels[index]
        except Exception:  # noqa: BLE001
            label = None
        seiten.append({'index': index + 1, 'label': label, 'text': text, 'bilder': bilder})
    return seiten


# --------------------------------------------------------------------------
# Prüfungen
# --------------------------------------------------------------------------

def befund(art, schwere, beschreibung, **details):
    return {'art': art, 'schwere': schwere, 'beschreibung': beschreibung, **details}


def aehnlichkeit(a, b):
    a, b = set(a), set(b)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def abdeckung(pdf_woerter, md_woerter):
    """Anteil der PDF-Wörter (ab Mindestlänge), die im Markdown vorkommen - exakt und unscharf."""
    lang = [w for w in pdf_woerter if len(w) >= SCHWELLEN['wortlaenge_abdeckung'] and not w.isdigit()]
    if not lang:
        return None, None, []
    md = set(md_woerter)
    md_lang = sorted(w for w in md if len(w) >= SCHWELLEN['wortlaenge_abdeckung'])
    exakt = [w for w in lang if w in md]
    fehlend = [w for w in lang if w not in md]
    unscharf = [w for w in fehlend if difflib.get_close_matches(w, md_lang, n=1, cutoff=SCHWELLEN['aehnlichkeit_unscharf'])]
    wirklich_fehlend = sorted({w for w in fehlend if w not in set(unscharf)})
    return len(exakt) / len(lang), (len(exakt) + len(unscharf)) / len(lang), wirklich_fehlend


def fehlende_zeilen(pdf_text, md_woerter):
    md = set(md_woerter)
    fehlen = []
    for zeile in pdf_text.split('\n'):
        w = [x for x in woerter(zeile) if not x.isdigit()]
        if len(w) < SCHWELLEN['zeile_min_woerter']:
            continue
        anteil = sum(1 for x in w if x in md) / len(w)
        if anteil < SCHWELLEN['zeile_gefunden']:
            fehlen.append(zeile.strip())
    return fehlen


def fragmente(seite):
    """Heuristik für abgetrennte Satzteile. Jeder Treffer ist menschlich zu prüfen."""
    treffer = []
    zeilen = [(n, KOMMENTAR.sub('', z)) for n, z in seite['zeilen']]
    inhalt = [(n, z.strip()) for n, z in zeilen]
    for i, (nummer, zeile) in enumerate(inhalt):
        if not zeile or zeile.startswith(('|', '#', '<!--')) or re.match(r'^[-*+]\s', zeile):
            continue
        vorher = inhalt[i - 1][1] if i > 0 else ''
        nachher = inhalt[i + 1][1] if i + 1 < len(inhalt) else ''
        worte = zeile.split()
        erstes = worte[0] if worte else ''
        # Worttrennung am Zeilenende, die nicht zusammengeführt wurde
        m = re.search(r'([A-Za-zÄÖÜäöüß]{2,})-$', zeile)
        if m and nachher:
            folgewort = nachher.split()[0].strip('.,;:').lower()
            if nachher[:1].islower() and folgewort not in KONJUNKTIONEN_NACH_TRENNSTRICH:
                treffer.append({'zeile': nummer, 'typ': 'worttrennung', 'text': f'{zeile} / {nachher}'})
        # Absatz beginnt klein nach Leerzeile: Satz wurde vermutlich abgetrennt
        if not vorher and erstes[:1].islower() and i > 0:
            treffer.append({'zeile': nummer, 'typ': 'absatz_beginnt_klein', 'text': zeile})
        # Absatz endet auf Komma, Bindestrich oder Füllwort: Satz bricht ab
        if not nachher and (zeile.endswith((',', '-', '–')) or (worte and worte[-1].lower() in FUELLWOERTER_ENDE)):
            treffer.append({'zeile': nummer, 'typ': 'satz_bricht_ab', 'text': zeile})
        # Einzelne kleingeschriebene Wörter als eigener Absatz
        if not vorher and not nachher and len(worte) <= 2 and erstes[:1].islower() and not re.search(r'[.!?:]$', zeile):
            treffer.append({'zeile': nummer, 'typ': 'isoliertes_fragment', 'text': zeile})
        # Fortlaufender Fließtext wurde in rohe OCR-Zeilen zerlegt. Das ist
        # nicht zwingend falsch, verhindert aber atomare, zitierbare Aussagen.
        # Nur Zeilen mit einem Prosasignal markieren; reine Titel/Stichworte
        # bleiben dadurch weitgehend außen vor.
        naechste_plain = bool(nachher) and not nachher.startswith(('|', '#', '<!--')) and not re.match(r'^[-*+]\s', nachher)
        wortmenge = {w.strip('.,;:!?()[]"').lower() for w in worte}
        if naechste_plain and len(worte) >= 3 and wortmenge & PROSA_SIGNAL and not SATZENDE.search(zeile):
            treffer.append({
                'zeile': nummer,
                'typ': 'prosazeile_ohne_satzabschluss',
                'text': f'{zeile} / {nachher}',
            })
    return treffer


def pruefe_datei(md_pfad, pdf_pfad, relativ):
    befunde = []
    md = lies_markdown(md_pfad)
    pdf = lies_pdf(pdf_pfad)
    n = len(pdf)
    # macOS speichert Umlaute in Dateinamen zerlegt (NFD); verglichen wird in NFC.
    erwartete_quelle = nfc(relativ.with_suffix('.pdf').as_posix())

    # Quellenpfad
    if md['quelle'] is None:
        befunde.append(befund('quelle', 'fehler', 'Keine Zeile "# Quelle:" gefunden.', erwartet=erwartete_quelle))
    elif md['quelle'] != erwartete_quelle:
        befunde.append(befund('quelle', 'fehler', 'Quellenpfad passt nicht zum tatsächlichen PDF.', gefunden=md['quelle'], erwartet=erwartete_quelle))

    # Seitenzahlen und Nummerierung
    marker = [s['marker'] for s in md['seiten']]
    if len(md['seiten']) != n:
        befunde.append(befund('seitenzahl', 'fehler', f'Markdown hat {len(md["seiten"])} Seiten, das PDF {n}.'))
    nummern = []
    for position, seite in enumerate(md['seiten'], start=1):
        try:
            nummern.append(int(seite['marker']))
        except ValueError:
            nummern.append(None)
            befunde.append(befund('seitennummer', 'fehler', f'Seitenmarker "{seite["marker"]}" ist keine Zahl.', zeile=seite['zeile']))
    doppelt = sorted({x for x in nummern if x is not None and nummern.count(x) > 1})
    if doppelt:
        befunde.append(befund('seitennummer', 'fehler', f'Doppelte Seitenmarker: {doppelt}.'))
    ausserhalb = [x for x in nummern if x is not None and not 1 <= x <= n]
    if ausserhalb:
        befunde.append(befund('seitennummer', 'fehler', f'Seitenmarker außerhalb der PDF-Seiten 1–{n}: {ausserhalb[0]}–{ausserhalb[-1]}.' if len(ausserhalb) > 1 else f'Seitenmarker {ausserhalb[0]} außerhalb der PDF-Seiten 1–{n}.'))
    gueltig = [x for x in nummern if x is not None]
    if gueltig != sorted(gueltig):
        befunde.append(befund('seitennummer', 'fehler', 'Seitenmarker sind nicht aufsteigend.'))
    if not ausserhalb and not doppelt and len(gueltig) == n:
        fehlend = sorted(set(range(1, n + 1)) - set(gueltig))
        if fehlend:
            befunde.append(befund('seitennummer', 'fehler', f'Seiten ohne Marker: {fehlend}.'))

    # Welche PDF-Seite beansprucht jede Markdown-Seite? Marker, falls im
    # Bereich; sonst die Position (die 1. Markdown-Seite zur 1. PDF-Seite).
    anspruch = [(x if x is not None and 1 <= x <= n else position) for position, x in enumerate(nummern, start=1)]

    pdf_woerter = [woerter(s['text']) for s in pdf]
    seitenberichte = []
    beste_je_md = []
    for position, seite in enumerate(md['seiten'], start=1):
        md_w = woerter(ohne_artefakte(seite['text']))
        ziel = anspruch[position - 1]
        pdf_seite = pdf[ziel - 1] if 1 <= ziel <= n else None
        werte = [aehnlichkeit(md_w, pw) for pw in pdf_woerter]
        beste = max(range(n), key=lambda j: werte[j]) + 1 if n else None
        beste_je_md.append(beste)
        bericht = {
            'position': position,
            'marker': seite['marker'],
            'zeile': seite['zeile'],
            'pdf_seite': ziel,
            'woerter_md': len(md_w),
            'aehnlichste_pdf_seite': beste,
            'aehnlichkeit_beanspruchte': round(werte[ziel - 1], 3) if pdf_seite else None,
            'aehnlichkeit_beste': round(werte[beste - 1], 3) if beste else None,
            'befunde': [],
        }
        ohne_text = pdf_seite is not None and len(pdf_seite['text'].strip()) < SCHWELLEN['min_zeichen_textschicht']
        bericht['pdf_ohne_textschicht'] = ohne_text
        if pdf_seite is None:
            bericht['befunde'].append(befund('zuordnung', 'fehler', f'Zu dieser Markdown-Seite gibt es keine PDF-Seite {ziel}.'))
        elif ohne_text:
            bericht['befunde'].append(befund('nur_visuell', 'pruefen', f'PDF-Seite {ziel} hat keine Textschicht (reines Bild). Inhalt nur am Seitenbild prüfbar.'))
            if len(md_w) < SCHWELLEN['min_woerter_zuordnung']:
                bericht['befunde'].append(befund('auslassung', 'fehler', f'Markdown-Seite enthält praktisch keinen Inhalt ({len(md_w)} Wörter ohne Platzhalter), die PDF-Seite ist ein Bild mit {pdf_seite["bilder"]} Bildobjekt(en).'))
        elif len(md_w) < SCHWELLEN['min_woerter_zuordnung']:
            bericht['befunde'].append(befund('zuordnung', 'warnung', f'Markdown-Seite hat nur {len(md_w)} Wörter; Zuordnung nicht prüfbar.'))
        elif beste != ziel and werte[beste - 1] > werte[ziel - 1] + 0.05:
            bericht['befunde'].append(befund('zuordnung', 'fehler', f'Inhalt passt besser zu PDF-Seite {beste} ({werte[beste - 1]:.2f}) als zur beanspruchten Seite {ziel} ({werte[ziel - 1]:.2f}).'))

        # Artefakte
        for art, muster in ARTEFAKTE:
            for nummer, zeile in seite['zeilen']:
                if art == 'platzhalter_spitz':
                    zeile = KOMMENTAR.sub('', zeile)
                for t in muster.finditer(zeile):
                    bericht['befunde'].append(befund('artefakt', 'fehler', f'Artefakt "{art}".', typ=art, zeile=nummer, text=t.group(0)))

        # Einstufung
        einst = seite['einstufungen']
        bericht['einstufungen'] = einst
        bericht['inline_einstufungen'] = seite['inline_einstufungen']
        if seite['einstufungen_unlesbar']:
            bericht['befunde'].append(befund('einstufung', 'fehler', f'{seite["einstufungen_unlesbar"]} Einstufung(en) im unerwarteten Format.'))
        elif not einst:
            bericht['befunde'].append(befund('einstufung', 'fehler', 'Keine Einstufung auf dieser Seite.'))
        for e in einst:
            if e['wert'] not in EINSTUFUNGEN:
                bericht['befunde'].append(befund('einstufung', 'fehler', f'Unbekannte Einstufung "{e["wert"]}".'))
            if not e['begruendung']:
                bericht['befunde'].append(befund('einstufung', 'fehler', 'Einstufung ohne Begründung.'))

        # Fragmente
        for f in fragmente(seite):
            bericht['befunde'].append(befund('fragment', 'pruefen', f'Mögliches Satzfragment ({f["typ"]}).', **f))

        # Inhalt, Zahlen und Einschränkungen gegen die beanspruchte PDF-Seite
        if pdf_seite and not ohne_text:
            exakt, unscharf, fehlend = abdeckung(pdf_woerter[ziel - 1], md_w)
            bericht['abdeckung_exakt'] = None if exakt is None else round(exakt, 3)
            bericht['abdeckung_mit_ocr_korrektur'] = None if unscharf is None else round(unscharf, 3)
            if unscharf is not None and unscharf < SCHWELLEN['abdeckung_stark']:
                bericht['befunde'].append(befund('auslassung', 'fehler', f'Nur {unscharf:.0%} der Wörter der PDF-Seite finden sich im Markdown – vermutlich Inhalt ausgelassen oder falsche Seite.', fehlende_woerter=fehlend[:60]))
            elif unscharf is not None and unscharf < SCHWELLEN['abdeckung_warnung']:
                bericht['befunde'].append(befund('auslassung', 'warnung', f'Nur {unscharf:.0%} der Wörter der PDF-Seite finden sich im Markdown.', fehlende_woerter=fehlend[:60]))
            zeilen_fehlen = fehlende_zeilen(pdf_seite['text'], md_w)
            if zeilen_fehlen:
                bericht['befunde'].append(befund('auslassung', 'pruefen', f'{len(zeilen_fehlen)} Zeile(n) der PDF-Seite nicht im Markdown gefunden.', zeilen=zeilen_fehlen))

            zahlen_befunde, md_z = zahlenabweichungen(
                pdf_seite['text'], seite['text'], '\n'.join(s['text'] for s in pdf),
            )
            for zahlen_befund in zahlen_befunde:
                # Seite in die menschenlesbare Meldung einsetzen, ohne die
                # strukturierte Ursache zu verändern.
                zahlen_befund['beschreibung'] = zahlen_befund['beschreibung'].replace('der PDF-Seite', f'der PDF-Seite {ziel}')
                bericht['befunde'].append(zahlen_befund)
            bericht['dosis_oder_grenzwerte_md'] = [z['roh'] for z in md_z if z['dosis'] or z['grenzwert']]

            e_pdf, e_md = einschraenkungen(pdf_seite['text']), einschraenkungen(ohne_artefakte(seite['text']))
            abweichend = {w: {'pdf': e_pdf.get(w, 0), 'md': e_md.get(w, 0)} for w in sorted(set(e_pdf) | set(e_md)) if e_pdf.get(w, 0) != e_md.get(w, 0)}
            if abweichend:
                bericht['befunde'].append(befund('einschraenkung', 'pruefen', 'Anzahl verneinender oder einschränkender Wörter weicht ab.', woerter=abweichend))
        seitenberichte.append(bericht)

    # Doppelte Inhalte und nicht abgedeckte PDF-Seiten
    inhalte = {}
    for bericht, seite in zip(seitenberichte, md['seiten']):
        inhalt = woerter(ohne_artefakte(seite['text']))
        if len(inhalt) >= SCHWELLEN['min_woerter_zuordnung']:
            schluessel = hashlib.sha256(' '.join(inhalt).encode()).hexdigest()
            inhalte.setdefault(schluessel, []).append(bericht['position'])
    for positionen in inhalte.values():
        if len(positionen) > 1:
            befunde.append(befund('doppelt', 'fehler', f'Markdown-Seiten an Position {positionen} haben identischen Inhalt.'))
    beansprucht = set(anspruch)
    for index in range(1, n + 1):
        if index not in beansprucht:
            befunde.append(befund('fehlende_seite', 'fehler', f'PDF-Seite {index} wird von keiner Markdown-Seite beansprucht.'))
        treffer = [p for p, b in enumerate(beste_je_md, start=1) if b == index]
        if len(treffer) > 1 and len(pdf[index - 1]['text'].strip()) >= SCHWELLEN['min_zeichen_textschicht']:
            befunde.append(befund('doppelt', 'warnung', f'Mehrere Markdown-Seiten (Positionen {treffer}) ähneln am meisten PDF-Seite {index}.'))

    # Einstufung: pro Seite oder pro Aussage?
    anzahl = [len(s['einstufungen']) for s in md['seiten']]
    inline = sum(s['inline_einstufungen'] for s in md['seiten'])
    if md['seiten'] and all(a == 1 for a in anzahl) and inline == 0:
        befunde.append(befund('einstufung_granularitaet', 'fehler', 'Einstufung nur pauschal pro Seite (genau eine je Seite), nicht pro atomarer Aussage.'))
    werte = sorted({e['wert'] for s in md['seiten'] for e in s['einstufungen']})

    return {
        'markdown': {'pfad': nfc(relativ.as_posix()), 'sha256': sha256(md_pfad), 'quelle': md['quelle'], 'seitenmarker': marker, 'zeilen': md['zeilen_gesamt']},
        'pdf': {
            'pfad': erwartete_quelle, 'sha256': sha256(pdf_pfad), 'seiten': n,
            'seitenlabels': [s['label'] for s in pdf],
            'seiten_ohne_textschicht': [s['index'] for s in pdf if len(s['text'].strip()) < SCHWELLEN['min_zeichen_textschicht']],
        },
        'einstufungswerte': werte,
        'befunde': befunde,
        'seiten': seitenberichte,
    }


# --------------------------------------------------------------------------
# Bericht
# --------------------------------------------------------------------------

DETERMINISTISCH = [
    'Seitenzahl Markdown gegen PDF, Seitenmarker (Zahl, doppelt, lückenlos, aufsteigend, im Bereich des PDFs).',
    'Zuordnung jeder Markdown-Seite zur ähnlichsten PDF-Seite (Wortmengen-Ähnlichkeit gegen die Textschicht).',
    'Doppelte Markdown-Seiten (identischer Inhalt) und PDF-Seiten ohne zugehörige Markdown-Seite.',
    'Artefakte und Platzhalter: [cite: …], [unleserlich], <Ordner> und andere Platzhalter in spitzen Klammern, [...], ??, Ersatz- und unsichtbare Zeichen, TODO.',
    'Quellenpfad in "# Quelle:" gegen den tatsächlichen Pfad des PDFs.',
    'Einstufung: vorhanden, erlaubter Wert, Begründung vorhanden, pro Seite oder pro Aussage.',
        'Zahlen als Multiset aus Wert und normalisierter Einheit gegen die Textschicht der beanspruchten PDF-Seite; Einheitenwechsel und -verlust sind harte Fehler.',
    'Abdeckung: Anteil der Wörter der PDF-Seite im Markdown (exakt und mit OCR-Korrektur), nicht gefundene PDF-Zeilen.',
    'Anzahl verneinender und einschränkender Wörter (nicht, kein, nur, ohne, möglicherweise, …) je Seite im Vergleich.',
    'Unverändertheit: SHA-256 aller Eingabedateien vor und nach dem Audit.',
]
MENSCHLICH = [
    'Ob die Textschicht des PDFs selbst stimmt. Sie stammt aus einer OCR der gescannten Seiten und kann Zahlen, Einheiten und Wörter falsch enthalten. Jede Zahlenabweichung ist daher am Seitenbild zu prüfen.',
    'Seiten ohne Textschicht (reine Bilder): Inhalt, Vollständigkeit und Zahlen nur visuell prüfbar.',
    'Handschrift, Tabellen, Diagramme und Grafiken: Die Textschicht gibt Anordnung und Zuordnung von Zellen nicht zuverlässig wieder.',
    'Ob Negationen und Einschränkungen im Sinn erhalten sind. Der Audit zählt nur die Wörter; ob "nicht" an der richtigen Stelle steht, muss ein Mensch lesen.',
    'Ob die Einstufung (Evidenz, Seminar-Hypothese, Erfahrungswert) fachlich stimmt.',
    'Ob gemeldete Satzfragmente wirklich abgetrennt sind; auf Folien sind kurze Zeilen oft Absicht (Überschriften, Stichworte).',
    'Ob eine Umformulierung durch Gemini die Aussage verändert hat, auch wenn alle Wörter und Zahlen vorhanden sind.',
]


def schreibe_berichte(ergebnisse, meta, ziel_json, ziel_md):
    ziel_json.write_text(json.dumps({'meta': meta, 'dateien': ergebnisse}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    def alle(datei):
        return datei['befunde'] + [b for s in datei['seiten'] for b in s['befunde']]

    zeilen = [
        '# Audit der bereinigten Seminarunterlagen',
        '',
        f'Entwurf von Gemini gegen die Original-PDFs, erstellt am {meta["erstellt"]}. **Ungeprüfter Entwurf – nicht in die Wissensbasis übernehmen.**',
        '',
        'Der Audit ist deterministisch: kein Sprachmodell, keine API, nichts verändert. '
        'Vergleichsgrundlage ist die OCR-Textschicht der PDFs, die selbst Fehler haben kann. '
        'Jeder Befund ist deshalb eine Stelle zum Nachsehen, kein Beweis für einen Fehler von Gemini.',
        '',
        f'- Markdown: `{meta["eingaben"]["markdown"]}` · PDFs: `{meta["eingaben"]["pdf"]}`',
        f'- Werkzeuge: Python {meta["werkzeuge"]["python"]}, pypdf {meta["werkzeuge"]["pypdf"]} · Skript {meta["skript_sha256"][:16]}',
        f'- Eingaben unverändert: **{"ja" if meta["eingaben_unveraendert"] else "NEIN"}** (SHA-256 vor und nach dem Audit)',
        '',
        '## Überblick',
        '',
        '| Datei | Seiten PDF/MD | Quelle | Seitenmarker | Artefakte | Zahlen (harte Fehler) | Auslassung prüfen | Einschränkungen prüfen | Fragmenthinweise | Nur visuell |',
        '|---|---|---|---|---|---|---|---|---|---|',
    ]
    for datei in ergebnisse:
        b = alle(datei)
        zahl = [x for x in b if x['art'] == 'zahl']
        zeilen.append('| {name} | {p}/{m} | {q} | {s} | {a} | {z} ({zd}) | {au} | {e} | {f} | {v} |'.format(
            name=datei['markdown']['pfad'],
            p=datei['pdf']['seiten'], m=len(datei['markdown']['seitenmarker']),
            q='✗' if any(x['art'] == 'quelle' for x in b) else '✓',
            s='✗' if any(x['art'] in ('seitennummer', 'seitenzahl', 'fehlende_seite') for x in b) else '✓',
            a=sum(1 for x in b if x['art'] == 'artefakt'),
            z=len(zahl), zd=sum(1 for x in zahl if x['schwere'] == 'fehler'),
            au=sum(1 for s in datei['seiten'] if any(x['art'] == 'auslassung' for x in s['befunde'])),
            e=sum(1 for s in datei['seiten'] if any(x['art'] == 'einschraenkung' for x in s['befunde'])),
            f=sum(1 for x in b if x['art'] == 'fragment'),
            v=', '.join(str(x) for x in datei['pdf']['seiten_ohne_textschicht']) or '–',
        ))
    zeilen += [
        '',
        'Spalten: Anzahl Befunde, bei „Auslassung“ und „Einschränkungen“ die Anzahl betroffener Seiten, bei „Fragmenthinweise“ konservative Heuristiktreffer (keine Entwarnung bei 0), bei „Nur visuell“ die PDF-Seiten ohne Textschicht.',
        '',
        '## Befunde, die für alle Dateien gelten',
        '',
    ]
    pauschal = [d['markdown']['pfad'] for d in ergebnisse if any(x['art'] == 'einstufung_granularitaet' for x in d['befunde'])]
    zeilen.append(f'- **Einstufung nur pro Seite:** {len(pauschal)} von {len(ergebnisse)} Dateien haben genau eine Einstufung je Seite und keine je Aussage. '
                  'Eine Seite mischt aber oft belegte, hypothetische und praktische Aussagen; die geforderte Einstufung pro Abschnitt bzw. Aussage fehlt.')
    werte = sorted({w for d in ergebnisse for w in d['einstufungswerte']})
    zeilen.append(f'- **Verwendete Einstufungen:** {", ".join(werte) or "keine"}.')
    ohne_partner = meta.get('ohne_partner') or []
    if ohne_partner:
        zeilen += [
            f'- **Fehlende Dateipartner:** {len(ohne_partner)}. Der Audit ist unvollständig und darf nicht als bestanden gelten.',
            *[f'  - `{eintrag.get("markdown") or eintrag.get("pdf")}`: {eintrag["grund"]}' for eintrag in ohne_partner],
        ]
    zeilen.append('')

    for datei in ergebnisse:
        b = alle(datei)
        zeilen += [f'## {datei["markdown"]["pfad"]}', '']
        for x in datei['befunde']:
            if x['art'] == 'einstufung_granularitaet':
                continue
            zusatz = f' (gefunden „{x["gefunden"]}“, erwartet „{x["erwartet"]}“)' if x['art'] == 'quelle' and 'gefunden' in x else ''
            zeilen.append(f'- **{x["schwere"]}:** {x["beschreibung"]}{zusatz}')
        artefakte = {}
        for x in b:
            if x['art'] == 'artefakt':
                artefakte[x['typ']] = artefakte.get(x['typ'], 0) + 1
        if artefakte:
            zeilen.append('- **fehler:** Artefakte: ' + ', '.join(f'{typ} ×{anzahl}' for typ, anzahl in sorted(artefakte.items())) + '.')
        for seite in datei['seiten']:
            punkte = []
            zahl_fehler = [x for x in seite['befunde'] if x['art'] == 'zahl' and x['schwere'] == 'fehler']
            for x in seite['befunde']:
                if x['art'] == 'artefakt':
                    continue
                if x['art'] == 'zahl' and (x['schwere'] != 'fehler' or zahl_fehler.index(x) >= 8):
                    continue
                if x['art'] == 'fragment':
                    continue
                text = x['beschreibung']
                if x['art'] == 'auslassung' and x.get('zeilen'):
                    text += ' Beispiele: ' + ' · '.join(f'„{z[:80]}“' for z in x['zeilen'][:3])
                if x['art'] == 'einschraenkung':
                    text += ' ' + ', '.join(f'„{w}“ PDF {v["pdf"]} / MD {v["md"]}' for w, v in x['woerter'].items())
                punkte.append(f'{x["schwere"]}: {text}')
            if len(zahl_fehler) > 8:
                punkte.append(f'fehler: … und {len(zahl_fehler) - 8} weitere Dosis- oder Grenzwertabweichungen (siehe bericht.json)')
            weitere_zahlen = sum(1 for x in seite['befunde'] if x['art'] == 'zahl' and x['schwere'] != 'fehler')
            if weitere_zahlen:
                punkte.append(f'warnung: {weitere_zahlen} weitere Zahlenabweichung(en) ohne Dosis- oder Grenzwertbezug')
            frag = [x for x in seite['befunde'] if x['art'] == 'fragment']
            if frag:
                punkte.append(f'prüfen: {len(frag)} mögliche Satzfragmente, z. B. „{frag[0]["text"][:70]}“')
            if punkte:
                kopf = f'Seite {seite["marker"]}' + (f' (PDF-Seite {seite["pdf_seite"]})' if str(seite['pdf_seite']) != seite['marker'] else '')
                abd = seite.get('abdeckung_mit_ocr_korrektur')
                kopf += f' · Abdeckung {abd:.0%}' if isinstance(abd, float) else ''
                zeilen.append(f'- {kopf}')
                zeilen += [f'  - {p}' for p in punkte]
        zeilen.append('')

    rang = sorted(
        ((s['abdeckung_mit_ocr_korrektur'], d['pdf']['pfad'], s['pdf_seite']) for d in ergebnisse for s in d['seiten'] if isinstance(s.get('abdeckung_mit_ocr_korrektur'), float)),
    )[:15]
    zeilen += ['## Seiten mit der geringsten Abdeckung', '',
               'Anteil der Wörter der PDF-Seite, die sich im Markdown wiederfinden (mit OCR-Korrektur). Niedrige Werte heißen: Inhalt fehlt, falsche Seite – oder die Textschicht des PDFs ist so schlecht, dass der Vergleich nichts aussagt.', '',
               '| Abdeckung | PDF | Seite |', '|---|---|---|'] + [f'| {w:.0%} | {pfad} | {seite} |' for w, pfad, seite in rang]
    zeilen += ['', '## Deterministisch geprüft', ''] + [f'- {x}' for x in DETERMINISTISCH]
    zeilen += ['', '## Muss anschließend visuell oder menschlich geprüft werden', ''] + [f'- {x}' for x in MENSCHLICH]
    sichtpruefung = []
    for datei in ergebnisse:
        seiten = sorted({s['pdf_seite'] for s in datei['seiten'] if any(x['schwere'] in ('fehler', 'pruefen') and x['art'] in ('nur_visuell', 'zahl', 'auslassung', 'einschraenkung', 'zuordnung') for x in s['befunde'])})
        if seiten:
            sichtpruefung.append(f'- {datei["pdf"]["pfad"]}: Seiten {", ".join(map(str, seiten))}')
    zeilen += ['', '### Konkrete PDF-Seiten zum Ansehen', '',
               'Seiten mit Dosis- oder Grenzwertabweichung, fehlenden Zeilen, abweichenden Einschränkungen, fraglicher Zuordnung oder ohne Textschicht:', ''] + sichtpruefung
    zeilen += ['', '## Schwellen', ''] + [f'- `{k}`: {v}' for k, v in SCHWELLEN.items()]
    zeilen += ['', 'Alle Einzelheiten (Zeilennummern, Zahlen, fehlende Wörter) stehen in `bericht.json`.']
    ziel_md.write_text('\n'.join(zeilen) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--md', type=Path, default=STANDARD_MD)
    parser.add_argument('--pdf', type=Path, default=STANDARD_PDF)
    parser.add_argument('--ausgabe', type=Path, default=HIER)
    args = parser.parse_args()

    if pypdf.__version__ != ERWARTETE_PYPDF_VERSION:
        parser.error(
            f'pypdf {ERWARTETE_PYPDF_VERSION} erforderlich, gefunden {pypdf.__version__}. '
            f'Installiere scripts/seminar-audit/requirements.txt in einer isolierten Umgebung.'
        )
    if not args.md.is_dir():
        parser.error(f'Markdown-Ordner nicht gefunden: {args.md}')
    if not args.pdf.is_dir():
        parser.error(f'PDF-Ordner nicht gefunden: {args.pdf}')

    md_dateien = sorted(p for p in args.md.rglob('*.md'))
    pdf_dateien = sorted(p for p in args.pdf.rglob('*.pdf'))
    eingaben = md_dateien + pdf_dateien
    vorher = {nfc(str(p)): sha256(p) for p in eingaben}

    ergebnisse = []
    ohne_partner = []
    for md_pfad in md_dateien:
        relativ = md_pfad.relative_to(args.md)
        pdf_pfad = args.pdf / relativ.with_suffix('.pdf')
        if not pdf_pfad.exists():
            ohne_partner.append({'markdown': nfc(relativ.as_posix()), 'grund': 'kein PDF mit gleichem Pfad'})
            continue
        ergebnisse.append(pruefe_datei(md_pfad, pdf_pfad, relativ))
    for pdf_pfad in pdf_dateien:
        relativ = pdf_pfad.relative_to(args.pdf)
        if not (args.md / relativ.with_suffix('.md')).exists():
            ohne_partner.append({'pdf': nfc(relativ.as_posix()), 'grund': 'kein Markdown mit gleichem Pfad'})

    nachher = {nfc(str(p)): sha256(p) for p in eingaben}
    meta = {
        'erstellt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'eingaben': {'markdown': str(args.md), 'pdf': str(args.pdf.relative_to(REPO)) if args.pdf.is_relative_to(REPO) else str(args.pdf)},
        'werkzeuge': {'python': sys.version.split()[0], 'pypdf': pypdf.__version__},
        'skript_sha256': sha256(__file__),
        'schwellen': SCHWELLEN,
        'eingaben_unveraendert': vorher == nachher,
        'eingabe_hashes': vorher,
        'ohne_partner': ohne_partner,
        'deterministisch_geprueft': DETERMINISTISCH,
        'menschlich_zu_pruefen': MENSCHLICH,
    }
    args.ausgabe.mkdir(parents=True, exist_ok=True)
    schreibe_berichte(ergebnisse, meta, args.ausgabe / 'bericht.json', args.ausgabe / 'bericht.md')
    vollstaendig = bool(ergebnisse) and not ohne_partner
    print(f'{len(ergebnisse)} Dateipaare geprüft, {len(ohne_partner)} ohne Partner. Eingaben unverändert: {vorher == nachher}.')
    print(f'Bericht: {args.ausgabe / "bericht.md"}')
    return 0 if vorher == nachher and vollstaendig else 1


if __name__ == '__main__':
    sys.exit(main())
