import importlib.util
import io
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

from pypdf import PdfWriter


MODUL_PFAD = Path(__file__).with_name('audit.py')
SPEZIFIKATION = importlib.util.spec_from_file_location('seminar_audit', MODUL_PFAD)
audit = importlib.util.module_from_spec(SPEZIFIKATION)
SPEZIFIKATION.loader.exec_module(audit)


class ZahlenTest(unittest.TestCase):
    def gruende(self, pdf, markdown):
        befunde, _ = audit.zahlenabweichungen(pdf, markdown)
        return [(b.get('grund'), b.get('pdf_einheit'), b.get('markdown_einheit')) for b in befunde]

    def test_milligramm_wird_nicht_zu_gramm(self):
        self.assertIn(('einheitenabweichung', 'mg', 'g'), self.gruende('500 mg', '500 g'))

    def test_millimeter_wird_nicht_zu_zentimeter(self):
        self.assertIn(('einheitenabweichung', 'mm', 'cm'), self.gruende('3 mm', '3 cm'))

    def test_einheitenverlust_wird_erkannt(self):
        self.assertIn(('einheitenabweichung', 'mg', ''), self.gruende('10 mg', '10'))

    def test_haeufigkeit_wird_geprueft(self):
        befunde, _ = audit.zahlenabweichungen('10 mg und nochmals 10 mg', '10 mg')
        fehlend = [b for b in befunde if b.get('grund') == 'nur_pdf']
        self.assertEqual(1, len(fehlend))
        self.assertEqual(1, fehlend[0]['anzahl'])

    def test_einheiten_alias_ist_erlaubt(self):
        befunde, _ = audit.zahlenabweichungen('1000 µg', '1000 mcg')
        self.assertEqual([], befunde)


class FragmentTest(unittest.TestCase):
    def test_fortlaufender_neurotransmitter_satz_wird_markiert(self):
        seite = {'zeilen': [
            (12, 'Neurotransmitter sind biochemische'),
            (13, 'Botenstoffe, die Information von einer'),
            (14, 'Nervenzelle zur anderen übertragen.'),
        ]}
        treffer = audit.fragmente(seite)
        self.assertTrue(any(t['zeile'] == 12 and t['typ'] == 'prosazeile_ohne_satzabschluss' for t in treffer))

    def test_ueberschrift_allein_wird_nicht_markiert(self):
        seite = {'zeilen': [(1, 'Neurotransmitter'), (2, ''), (3, 'Dopamin')]}
        self.assertEqual([], audit.fragmente(seite))


class SeitenUndQuellenTest(unittest.TestCase):
    def test_falsche_quelle_und_seitenzahl_werden_erkannt(self):
        with tempfile.TemporaryDirectory() as ordner:
            basis = Path(ordner)
            md = basis / 'Dokument.md'
            pdf = basis / 'Dokument.pdf'
            md.write_text('# Quelle: falsch.pdf\n\n## Seite 9\n<!-- einstufung: evidenz -- begründung: Test. -->\nInhalt.\n', encoding='utf-8')
            writer = PdfWriter()
            writer.add_blank_page(width=100, height=100)
            with pdf.open('wb') as ausgabe:
                writer.write(ausgabe)
            ergebnis = audit.pruefe_datei(md, pdf, Path('Dokument.md'))
            arten = {b['art'] for b in ergebnis['befunde']}
            self.assertIn('quelle', arten)
            self.assertIn('seitennummer', arten)

    def test_fehlender_eingabeordner_bricht_ab(self):
        with tempfile.TemporaryDirectory() as ordner:
            basis = Path(ordner)
            with patch('sys.argv', ['audit.py', '--md', str(basis / 'fehlt'), '--pdf', str(basis)]):
                with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as fehler:
                    audit.main()
            self.assertEqual(2, fehler.exception.code)

    def test_dateien_ohne_partner_liefern_fehlerstatus_und_bericht(self):
        with tempfile.TemporaryDirectory() as ordner:
            basis = Path(ordner)
            md_ordner, pdf_ordner, ausgabe = basis / 'md', basis / 'pdf', basis / 'bericht'
            md_ordner.mkdir()
            pdf_ordner.mkdir()
            (md_ordner / 'NurMarkdown.md').write_text('# Quelle: NurMarkdown.pdf\n', encoding='utf-8')
            with patch('sys.argv', ['audit.py', '--md', str(md_ordner), '--pdf', str(pdf_ordner), '--ausgabe', str(ausgabe)]):
                with redirect_stdout(io.StringIO()):
                    self.assertEqual(1, audit.main())
            bericht = (ausgabe / 'bericht.md').read_text(encoding='utf-8')
            self.assertIn('Fehlende Dateipartner', bericht)
            self.assertIn('NurMarkdown.md', bericht)


if __name__ == '__main__':
    unittest.main()
