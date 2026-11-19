#!/usr/bin/env python3
"""
Extract the Social Insurance Fund final accounts from the official Social Insurance Services
statistical bulletins (Greek and English editions).

Steps:
  1. Download every edition in tools/sis/manifest.json into data-cache/sis/ (gitignored).
  2. Verify the file's SHA-256 against the manifest (abort on mismatch: the publisher changed it).
  3. Convert with `antiword` (no macros executed) and parse the "Final accounts" table.
  4. Write src/data/sifAccountsEditions.json with every edition's table (revision history).

The original Word documents are NOT committed (redistribution terms not established); this
script, the manifest (URLs + hashes) and the extracted numbers are.

Requires: Python 3.10+, antiword. Usage: python3 -I tools/sis/extract_bulletins.py [--offline]
"""
from __future__ import annotations
import hashlib, json, os, re, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, 'data-cache', 'sis')
MANIFEST = os.path.join(ROOT, 'tools', 'sis', 'manifest.json')
OUT = os.path.join(ROOT, 'src', 'data', 'sifAccountsEditions.json')

# Row label prefixes → canonical item names (both languages).
LABELS = [
    (('ΑΠΟΘΕΜΑΤΙΚΟ ΑΡΧΗ', 'RESERVE AT THE BEGINNING'), 'reserveOpening'),
    (('Μισθωτοί ιδιωτικού', 'Employed persons-private'), 'privateEmployees'),
    (('Μισθωτοί δημόσιου', 'Employed persons-public'), 'publicEmployees'),
    (('Αυτοτελώς', 'Self-employed'), 'selfEmployed'),
    (('Προαιρετικά', 'Voluntary'), 'voluntary'),
    (('Γενική Κυβερνητική', 'General Government'), 'state'),
    (('Τόκοι', 'Interest'), 'interest'),
    (('Άλλα έσοδα', 'Other receipts'), 'otherIncome'),
    (('ΣΥΝΟΛΟ ΕΣΟΔΩΝ', 'TOTAL RECEIPTS'), 'totalIncome'),
    (('Συντάξεις', 'Pensions'), 'pensions'),
    (('Άλλες παροχές', 'Other benefits'), 'otherBenefits'),
    (('Ιατροφαρμακευτική', 'Medical care'), 'medical'),
    (('Διοικητικά', 'Administrative'), 'admin'),
    (('ΣΥΝΟΛΟ ΕΞΟΔΩΝ', 'TOTAL EXPENDITURE'), 'totalExpenditure'),
    (('ΔΙΑΦΟΡΑ', 'DIFFERENCE'), 'balance'),
    (('ΑΠΟΘΕΜΑΤΙΚΟ ΤΕΛΟΣ', 'RESERVE AT THE END'), 'reserveClosing'),
]
TITLE = ('Τελικοί λογαριασμοί', 'Final accounts')
PRELIM = ('προκαταρ', 'preliminary')  # older editions hyphenate: 'προκαταρ-κτικά'


def number(cell: str) -> int | None:
    c = cell.strip().replace('.', '')
    return int(c) if re.fullmatch(r'-?\d+', c) else None


def parse(text: str) -> dict:
    lines = text.splitlines()
    start = next((i for i, l in enumerate(lines) if any(t in l for t in TITLE)), None)
    if start is None:
        raise ValueError('final accounts table not found')
    years: list[str] = []
    prelim: list[str] = []
    rows: dict[str, dict[str, int]] = {}
    pending: str | None = None  # older layout: label on the year row, values on a later unlabelled row
    for line in lines[start + 1 : start + 45]:
        if '|' not in line:
            continue
        cells = [c.strip() for c in line.split('|')[1:-1]]
        if not years and any(re.fullmatch(r'20\d\d', c) for c in cells):
            years = [c for c in cells if re.fullmatch(r'20\d\d', c)]
            head = cells[0].replace('’', '').strip()
            pending = next((n for pf, n in LABELS if any(head.startswith(p) for p in pf)), None)
            continue
        if pending and cells and cells[0] == '' and all(number(c) is not None for c in cells[1 : 1 + len(years)]):
            rows[pending] = dict(zip(years, [number(c) for c in cells[1 : 1 + len(years)]]))  # type: ignore[misc]
            pending = None
            continue
        if any(p in c for c in cells for p in PRELIM):
            prelim = [years[j] for j, c in enumerate(cells[1:]) if any(p in c for p in PRELIM)]
            continue
        label = cells[0].replace('’', '').replace("'", '').strip()
        for prefixes, name in LABELS:
            if any(label.startswith(p) for p in prefixes):
                if all(c == '' for c in cells[1 : 1 + len(years)]):
                    pending = name  # wrapped row: values follow on the next unlabelled line
                    break
                vals = [number(c) for c in cells[1 : 1 + len(years)]]
                if None in vals:
                    raise ValueError(f'non-numeric cell in row {name}: {cells}')
                rows[name] = dict(zip(years, vals))
    missing = [n for _, n in LABELS if n not in rows]
    if missing:
        raise ValueError(f'rows not found: {missing}')
    return {'years': years, 'preliminary': prelim, 'rows': rows}


def main() -> int:
    offline = '--offline' in sys.argv
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    os.makedirs(CACHE, exist_ok=True)
    editions = []
    for e in manifest['editions']:
        path = os.path.join(CACHE, e['fileName'])
        if not os.path.exists(path):
            if offline:
                raise SystemExit(f'missing cached file {e["fileName"]} (run without --offline)')
            req = urllib.request.Request(e['url'], headers={'User-Agent': 'Mozilla/5.0 (research data extraction)'})
            with urllib.request.urlopen(req, timeout=60) as r, open(path, 'wb') as fh:
                fh.write(r.read())
        digest = hashlib.sha256(open(path, 'rb').read()).hexdigest()
        if digest != e['sha256']:
            raise SystemExit(f'SHA-256 mismatch for {e["fileName"]}: {digest} (publisher may have revised the file)')
        text = subprocess.run(['antiword', '-w', '0', path], capture_output=True, text=True, check=True).stdout
        editions.append({**{k: e[k] for k in ('id', 'language', 'edition', 'url', 'fileName', 'sha256')}, **parse(text)})
    doc = {
        'generator': 'tools/sis/extract_bulletins.py',
        'units': '€ thousand',
        'publisher': manifest['publisher'],
        'archive': manifest['archive'],
        'accessed': manifest['accessed'],
        'note': manifest['note'],
        'editions': editions,
    }
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
    print(f'wrote {OUT}: {len(editions)} editions')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
