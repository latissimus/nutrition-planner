import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import validate_knowledge


VALID_DOC = """---
schema_version: 1
document_id: test-dokument
source_pdf: Seminarunterlagen/Test.pdf
source_sha256: {source_hash}
source_pages: 1
review_status: reviewed
review_method: visual-original-pdf
---

# Test

## PDF-Seite 1

### test-dokument-p001-c001

**Einstufung:** `seminar-hypothese`

**Themen:** `test`

**Sicherheitsmarker:** `diagnostik`

**Originalausschnitt:** „Das Seminar nennt 10 mm als Wert.“

**Normalisierte Aussage:** Das Seminar nennt 10 mm als Wert.

**Begründung:** Die Aussage ist nicht belegt.

**Verwendungsgrenze:** Nicht diagnostisch verwenden.
"""


class ValidatorTests(unittest.TestCase):
    def make_fixture(self, document_text=VALID_DOC):
        temp = tempfile.TemporaryDirectory()
        root = Path(temp.name)
        source_dir = root / "Seminarunterlagen"
        knowledge_dir = root / "Seminarwissen"
        source_dir.mkdir()
        knowledge_dir.mkdir()
        source = source_dir / "Test.pdf"
        source.write_bytes(b"fake pdf")
        source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
        manifest = {
            "schema_version": 1,
            "documents": [
                {
                    "id": "test-dokument",
                    "source_pdf": "Seminarunterlagen/Test.pdf",
                    "source_sha256": source_hash,
                    "pages": 1,
                    "output": "Test.md",
                    "status": "reviewed",
                }
            ],
        }
        (knowledge_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        (knowledge_dir / "Test.md").write_text(document_text.format(source_hash=source_hash), encoding="utf-8")
        return temp, root, knowledge_dir

    @patch("validate_knowledge.pdf_pages", return_value=1)
    def test_valid_document_passes(self, _pdf_pages):
        temp, root, knowledge_dir = self.make_fixture()
        self.addCleanup(temp.cleanup)
        report = validate_knowledge.validate(root, knowledge_dir)
        self.assertEqual([], report.errors)
        self.assertEqual(1, report.checked_claims)

    @patch("validate_knowledge.pdf_pages", return_value=1)
    def test_invented_number_fails(self, _pdf_pages):
        text = VALID_DOC.replace("nennt 10 mm als Wert.\n\n**Begründung", "nennt 12 mm als Wert.\n\n**Begründung")
        temp, root, knowledge_dir = self.make_fixture(text)
        self.addCleanup(temp.cleanup)
        report = validate_knowledge.validate(root, knowledge_dir)
        self.assertIn("invented_number", {finding.code for finding in report.errors})

    @patch("validate_knowledge.pdf_pages", return_value=1)
    def test_evidence_needs_source(self, _pdf_pages):
        text = VALID_DOC.replace("`seminar-hypothese`", "`evidenz`")
        temp, root, knowledge_dir = self.make_fixture(text)
        self.addCleanup(temp.cleanup)
        report = validate_knowledge.validate(root, knowledge_dir)
        self.assertIn("evidence_source", {finding.code for finding in report.errors})

    @patch("validate_knowledge.pdf_pages", return_value=1)
    def test_claim_page_must_match_section(self, _pdf_pages):
        text = VALID_DOC.replace("p001-c001", "p002-c001")
        temp, root, knowledge_dir = self.make_fixture(text)
        self.addCleanup(temp.cleanup)
        report = validate_knowledge.validate(root, knowledge_dir)
        self.assertIn("claim_page", {finding.code for finding in report.errors})

    @patch("validate_knowledge.pdf_pages", return_value=1)
    def test_reviewed_document_must_cover_every_page(self, _pdf_pages):
        text = VALID_DOC.replace("## PDF-Seite 1", "## Einleitung")
        temp, root, knowledge_dir = self.make_fixture(text)
        self.addCleanup(temp.cleanup)
        report = validate_knowledge.validate(root, knowledge_dir)
        self.assertIn("reviewed_pages", {finding.code for finding in report.errors})

    @patch("validate_knowledge.pdf_pages", return_value=1)
    def test_declared_blank_page_may_have_no_claim(self, _pdf_pages):
        text = VALID_DOC.replace("### test-dokument-p001-c001", "*Leerseite im Original.*\n\n### entfernt")
        text = text.split("\n### entfernt", 1)[0] + "\n"
        temp, root, knowledge_dir = self.make_fixture(text)
        self.addCleanup(temp.cleanup)
        manifest_path = knowledge_dir / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["documents"][0]["blank_pages"] = [1]
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        report = validate_knowledge.validate(root, knowledge_dir)
        self.assertEqual([], report.errors)


if __name__ == "__main__":
    unittest.main()
