#!/usr/bin/env python3
"""Validiert die kontrollierte Seminar-Wissensbasis ohne API-Aufrufe.

Die Original-PDFs sind die Quelle. Der Validator prüft Struktur, Bindung an die
Quelle und sicherheitsrelevante Metadaten. Eine fachliche Freigabe ersetzt er
nicht; dafür bleibt die visuelle Prüfung der Originalseiten erforderlich.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path


ALLOWED_CLASSIFICATIONS = {"evidenz", "seminar-hypothese", "erfahrungswert"}
ALLOWED_SAFETY = {
    "keine",
    "diagnostik",
    "hormone",
    "supplement",
    "dosierung",
    "ernaehrung",
    "training",
    "schlaf",
    "krankheit",
    "medikament",
}
REQUIRED_FIELDS = {
    "Einstufung",
    "Themen",
    "Sicherheitsmarker",
    "Originalausschnitt",
    "Normalisierte Aussage",
    "Begründung",
    "Verwendungsgrenze",
}
FORBIDDEN_MARKERS = (
    "[cite]",
    "[unleserlich]",
    "[unklar]",
    "<ordner>",
    "todo",
    "platzhalter",
)
CLAIM_ID_RE = re.compile(r"^(?P<doc>[a-z0-9-]+)-p(?P<page>\d{3})-c(?P<claim>\d{3})$")
FIELD_RE = re.compile(r"^\*\*(?P<name>[^*]+):\*\*\s*(?P<value>.*)$")
NUMBER_UNIT_RE = re.compile(
    r"(?<![\w])(?P<number>[<>≤≥]?\s*[+-]?\d+(?:[.,]\d+)?)\s*"
    r"(?P<unit>mm|cm|kg|g|mg|µg|mcg|kcal|kj|%|stunden?|std\.?|minuten?|min\.?|tage?|wochen?)?",
    re.IGNORECASE,
)


@dataclass
class Finding:
    level: str
    code: str
    message: str
    document: str | None = None
    claim: str | None = None

    def as_dict(self) -> dict[str, str]:
        data = {"level": self.level, "code": self.code, "message": self.message}
        if self.document:
            data["document"] = self.document
        if self.claim:
            data["claim"] = self.claim
        return data


@dataclass
class Report:
    findings: list[Finding] = field(default_factory=list)
    checked_documents: int = 0
    checked_claims: int = 0

    def add(self, level: str, code: str, message: str, document: str | None = None, claim: str | None = None) -> None:
        self.findings.append(Finding(level, code, message, document, claim))

    @property
    def errors(self) -> list[Finding]:
        return [item for item in self.findings if item.level == "error"]

    @property
    def warnings(self) -> list[Finding]:
        return [item for item in self.findings if item.level == "warning"]


def normalized_name(value: str) -> str:
    return unicodedata.normalize("NFC", value)


def resolve_unicode_path(root: Path, relative: str) -> Path | None:
    """Löst NFC/NFD-Unterschiede komponentenweise auf."""
    current = root
    for part in Path(relative).parts:
        direct = current / part
        if direct.exists():
            current = direct
            continue
        wanted = normalized_name(part)
        try:
            match = next(child for child in current.iterdir() if normalized_name(child.name) == wanted)
        except (StopIteration, FileNotFoundError):
            return None
        current = match
    return current


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def pdf_pages(path: Path) -> int | None:
    candidates = ["pdfinfo", "/usr/local/bin/pdfinfo"]
    bundled = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdfinfo"
    if bundled.exists():
        candidates.insert(0, str(bundled))
    for command in candidates:
        try:
            result = subprocess.run([command, str(path)], check=True, capture_output=True, text=True)
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue
        match = re.search(r"^Pages:\s+(\d+)\s*$", result.stdout, re.MULTILINE)
        if match:
            return int(match.group(1))
    return None


def parse_frontmatter(text: str) -> tuple[dict[str, object], str]:
    if not text.startswith("---\n"):
        raise ValueError("YAML-Metadaten fehlen")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("YAML-Metadaten sind nicht abgeschlossen")
    metadata: dict[str, object] = {}
    for raw in text[4:end].splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if ":" not in raw:
            raise ValueError(f"Ungültige Metadatenzeile: {raw}")
        key, value = raw.split(":", 1)
        value = value.strip()
        if value.isdigit():
            metadata[key.strip()] = int(value)
        else:
            metadata[key.strip()] = value
    return metadata, text[end + 5 :]


def strip_ticks(value: str) -> str:
    return value.strip().strip("`").strip()


def split_csv(value: str) -> list[str]:
    return [strip_ticks(item) for item in value.split(",") if strip_ticks(item)]


def parse_claims(body: str) -> tuple[dict[int, list[tuple[str, dict[str, str]]]], list[str]]:
    pages: dict[int, list[tuple[str, dict[str, str]]]] = {}
    parsing_errors: list[str] = []
    current_page: int | None = None
    current_id: str | None = None
    current_fields: dict[str, str] = {}

    def flush() -> None:
        nonlocal current_id, current_fields
        if current_id is not None:
            if current_page is None:
                parsing_errors.append(f"Wissenseinheit {current_id} steht vor einer PDF-Seite")
            else:
                pages.setdefault(current_page, []).append((current_id, current_fields))
        current_id = None
        current_fields = {}

    lines = body.splitlines()
    index = 0
    while index < len(lines):
        line = lines[index]
        page_match = re.match(r"^## PDF-Seite (\d+)\s*$", line)
        claim_match = re.match(r"^### ([a-z0-9-]+)\s*$", line)
        if page_match:
            flush()
            current_page = int(page_match.group(1))
            pages.setdefault(current_page, [])
        elif claim_match:
            flush()
            current_id = claim_match.group(1)
        elif current_id:
            field_match = FIELD_RE.match(line)
            if field_match:
                name = field_match.group("name").strip()
                value_lines = [field_match.group("value").strip()]
                lookahead = index + 1
                while lookahead < len(lines):
                    candidate = lines[lookahead]
                    if candidate.startswith("##") or FIELD_RE.match(candidate):
                        break
                    if candidate.strip():
                        value_lines.append(candidate.strip())
                    lookahead += 1
                current_fields[name] = " ".join(value_lines).strip()
                index = lookahead - 1
        index += 1
    flush()
    return pages, parsing_errors


def normalized_numeric_pairs(text: str) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for match in NUMBER_UNIT_RE.finditer(text):
        number = re.sub(r"[\s<>≤≥]+", "", match.group("number")).replace(",", ".")
        unit = (match.group("unit") or "").lower().rstrip(".")
        aliases = {
            "stunde": "stunden",
            "std": "stunden",
            "minute": "minuten",
            "min": "minuten",
            "tag": "tage",
            "woche": "wochen",
            "mcg": "µg",
        }
        unit = aliases.get(unit, unit)
        pairs.append((number, unit))
    return pairs


def validate_claim(report: Report, document_id: str, page: int, claim_id: str, fields: dict[str, str]) -> None:
    report.checked_claims += 1
    match = CLAIM_ID_RE.match(claim_id)
    if not match:
        report.add("error", "claim_id", "Ungültige Wissenseinheiten-ID", document_id, claim_id)
    else:
        if match.group("doc") != document_id:
            report.add("error", "claim_document", "ID gehört nicht zum Dokument", document_id, claim_id)
        if int(match.group("page")) != page:
            report.add("error", "claim_page", f"ID nennt Seite {int(match.group('page'))}, Abschnitt Seite {page}", document_id, claim_id)

    missing = sorted(REQUIRED_FIELDS - fields.keys())
    if missing:
        report.add("error", "claim_fields", f"Pflichtfelder fehlen: {', '.join(missing)}", document_id, claim_id)
        return

    classification = strip_ticks(fields["Einstufung"])
    if classification not in ALLOWED_CLASSIFICATIONS:
        report.add("error", "classification", f"Unzulässige Einstufung: {classification}", document_id, claim_id)
    if classification == "evidenz" and not fields.get("Evidenzquelle", "").strip():
        report.add("error", "evidence_source", "Evidenz benötigt eine identifizierbare Evidenzquelle", document_id, claim_id)

    topics = split_csv(fields["Themen"])
    if not topics:
        report.add("error", "topics", "Mindestens ein Thema ist erforderlich", document_id, claim_id)

    markers = split_csv(fields["Sicherheitsmarker"])
    unknown = sorted(set(markers) - ALLOWED_SAFETY)
    if unknown:
        report.add("error", "safety_marker", f"Unzulässige Sicherheitsmarker: {', '.join(unknown)}", document_id, claim_id)
    if "keine" in markers and len(markers) > 1:
        report.add("error", "safety_none", "'keine' darf nicht mit weiteren Sicherheitsmarkern kombiniert werden", document_id, claim_id)

    for name in REQUIRED_FIELDS:
        value = fields[name].strip()
        if not value:
            report.add("error", "empty_field", f"Feld {name} ist leer", document_id, claim_id)
        lower = value.lower()
        for marker in FORBIDDEN_MARKERS:
            if marker in lower:
                report.add("error", "open_marker", f"Offener Marker in {name}: {marker}", document_id, claim_id)

    statement = fields["Normalisierte Aussage"].strip()
    if statement and statement[-1] not in ".!?“”":
        report.add("error", "sentence", "Normalisierte Aussage endet nicht als vollständiger Satz", document_id, claim_id)

    original_numbers = set(normalized_numeric_pairs(fields["Originalausschnitt"]))
    for pair in normalized_numeric_pairs(statement):
        if pair not in original_numbers:
            report.add(
                "error",
                "invented_number",
                f"Zahl/Einheit {pair[0]} {pair[1] or '(ohne Einheit)'} kommt im Originalausschnitt nicht vor",
                document_id,
                claim_id,
            )


def validate(root: Path, knowledge_dir: Path) -> Report:
    report = Report()
    manifest_path = knowledge_dir / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        report.add("error", "manifest", f"Manifest kann nicht gelesen werden: {exc}")
        return report

    documents = manifest.get("documents")
    if not isinstance(documents, list):
        report.add("error", "manifest_documents", "Manifest enthält keine Dokumentliste")
        return report

    seen_ids: set[str] = set()
    seen_claim_ids: set[str] = set()
    listed_outputs: set[Path] = set()
    allowed_status = {"pending", "draft", "reviewed"}

    for entry in documents:
        if not isinstance(entry, dict):
            report.add("error", "manifest_entry", "Dokumenteintrag ist kein Objekt")
            continue
        document_id = str(entry.get("id", ""))
        report.checked_documents += 1
        if not document_id:
            report.add("error", "document_id", "Dokument-ID fehlt")
            continue
        if document_id in seen_ids:
            report.add("error", "duplicate_document", "Dokument-ID ist doppelt", document_id)
        seen_ids.add(document_id)

        status = entry.get("status")
        if status not in allowed_status:
            report.add("error", "status", f"Unzulässiger Status: {status}", document_id)

        source_rel = str(entry.get("source_pdf", ""))
        source = resolve_unicode_path(root, source_rel)
        if source is None or not source.is_file():
            report.add("error", "source_missing", f"Original-PDF fehlt: {source_rel}", document_id)
            continue
        expected_hash = str(entry.get("source_sha256", ""))
        actual_hash = sha256(source)
        if actual_hash != expected_hash:
            report.add("error", "source_hash", f"PDF-Hash weicht ab: {actual_hash}", document_id)
        actual_pages = pdf_pages(source)
        expected_pages = entry.get("pages")
        if actual_pages is None:
            report.add("warning", "pdf_pages_unavailable", "PDF-Seitenzahl konnte nicht geprüft werden", document_id)
        elif actual_pages != expected_pages:
            report.add("error", "page_count", f"PDF hat {actual_pages} statt {expected_pages} Seiten", document_id)

        output_rel = Path(str(entry.get("output", "")))
        output = knowledge_dir / output_rel
        listed_outputs.add(output.resolve())
        if not output.exists():
            if status != "pending":
                report.add("error", "output_missing", f"Ausgabedatei fehlt bei Status {status}", document_id)
            continue

        try:
            metadata, body = parse_frontmatter(output.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            report.add("error", "frontmatter", str(exc), document_id)
            continue

        expected_meta = {
            "schema_version": manifest.get("schema_version"),
            "document_id": document_id,
            "source_pdf": source_rel,
            "source_sha256": expected_hash,
            "source_pages": expected_pages,
            "review_status": status,
        }
        for key, expected in expected_meta.items():
            if metadata.get(key) != expected:
                report.add("error", "metadata", f"Metadatum {key}: {metadata.get(key)!r} statt {expected!r}", document_id)

        pages, parsing_errors = parse_claims(body)
        for message in parsing_errors:
            report.add("error", "parse", message, document_id)
        if status == "reviewed":
            expected_page_set = set(range(1, int(expected_pages) + 1))
            if set(pages) != expected_page_set:
                report.add("error", "reviewed_pages", f"Freigegebenes Dokument deckt Seiten {sorted(pages)} statt {sorted(expected_page_set)} ab", document_id)
            blank_pages = set(entry.get("blank_pages", []))
            invalid_blank_pages = sorted(blank_pages - expected_page_set)
            if invalid_blank_pages:
                report.add("error", "blank_page_range", f"Leerseiten liegen außerhalb der Quelle: {invalid_blank_pages}", document_id)
            for page in expected_page_set:
                if not pages.get(page) and page not in blank_pages:
                    report.add("error", "empty_page", f"Freigegebene PDF-Seite {page} enthält keine Wissenseinheit", document_id)
                if pages.get(page) and page in blank_pages:
                    report.add("error", "blank_page_claim", f"Als leer markierte PDF-Seite {page} enthält Wissenseinheiten", document_id)

        for page, claims in pages.items():
            if page < 1 or page > int(expected_pages):
                report.add("error", "page_range", f"Abschnitt PDF-Seite {page} liegt außerhalb der Quelle", document_id)
            for claim_id, fields in claims:
                if claim_id in seen_claim_ids:
                    report.add("error", "duplicate_claim", "Wissenseinheiten-ID ist doppelt", document_id, claim_id)
                seen_claim_ids.add(claim_id)
                validate_claim(report, document_id, page, claim_id, fields)

    for markdown in knowledge_dir.rglob("*.md"):
        if markdown.name == "README.md":
            continue
        if markdown.resolve() not in listed_outputs:
            report.add("error", "unlisted_output", f"Markdown ist nicht im Manifest gelistet: {markdown.relative_to(knowledge_dir)}")
    return report


def write_report(report: Report, path: Path) -> None:
    payload = {
        "checked_documents": report.checked_documents,
        "checked_claims": report.checked_claims,
        "errors": len(report.errors),
        "warnings": len(report.warnings),
        "findings": [item.as_dict() for item in report.findings],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--knowledge-dir", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    knowledge_dir = (args.knowledge_dir or root / "Seminarwissen").resolve()
    report = validate(root, knowledge_dir)
    if args.report:
        write_report(report, args.report)
    print(
        f"Seminarwissen: {report.checked_documents} Dokumente, {report.checked_claims} Wissenseinheiten, "
        f"{len(report.errors)} Fehler, {len(report.warnings)} Warnungen"
    )
    for finding in report.findings:
        location = " / ".join(item for item in (finding.document, finding.claim) if item)
        suffix = f" [{location}]" if location else ""
        print(f"{finding.level.upper()}: {finding.code}: {finding.message}{suffix}")
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
