#!/usr/bin/env python3
"""Extract Excel 'due as at' openings for Vacate baseline import.

Usage:
  python3 scripts/extract-excel-baseline.py \\
    --xlsx "leavedata/Staff Leave 2025 - 2027.xlsx" \\
    --as-of 2026-06-30 \\
    --out leavedata/baseline-raw.json
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path

import openpyxl


def normalize(name: str) -> str:
    name = re.sub(r"^(Mrs?|Miss|Ms)\.?\s+", "", name.strip(), flags=re.I)
    name = re.sub(r"[^A-Za-z\s]", " ", name)
    return re.sub(r"\s+", " ", name).strip().lower()


def as_of_to_label(as_of: str) -> str:
    """2026-06-30 -> 'due as at 30.06.2026' (Excel label style)."""
    y, m, d = as_of.split("-")
    return f"due as at {int(d):02d}.{int(m):02d}.{y}"


def find_due_row(rows, label: str):
    label_l = label.lower()
    # Also try without leading zero variants already handled by format
    for i, r in enumerate(rows):
        v = r[0]
        if isinstance(v, str) and v.strip().lower() == label_l:
            return i, v
    # Fuzzy: match month/year tokens
    y, m, d = label_l.replace("due as at ", "").split(".")
    for i, r in enumerate(rows):
        v = r[0]
        if not isinstance(v, str):
            continue
        s = v.strip().lower()
        if "due as at" in s and f".{m}.{y}" in s:
            return i, v
    return None, None


def extract_sheet(ws, as_of: str):
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    header_i = None
    for i, r in enumerate(rows):
        if r and r[0] == "Date" and len(r) > 1 and r[1] == "Day":
            header_i = i
            break
    if header_i is None:
        return {}

    header = rows[header_i]
    employees = []
    for j, v in enumerate(header):
        if j < 2 or v is None:
            continue
        name = str(v).strip()
        if name:
            employees.append((j, name))

    label = as_of_to_label(as_of)
    due_i, due_label = find_due_row(rows, label)
    if due_i is None:
        raise SystemExit(f"Could not find due row for {as_of} (tried '{label}') in {ws.title}")

    due = rows[due_i]
    out = {}
    for j, excel_name in employees:
        val = due[j] if j < len(due) else None
        if isinstance(val, (int, float)):
            out[excel_name] = float(val)
        else:
            out[excel_name] = None
    return {"due_label": due_label, "balances": out}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", required=True)
    ap.add_argument("--as-of", default="2026-06-30", help="ISO date matching Excel due row")
    ap.add_argument("--out", default="leavedata/baseline-raw.json")
    args = ap.parse_args()

    path = Path(args.xlsx)
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)

    annual = extract_sheet(wb["Annual Leave 2025 - 2027"], args.as_of)
    sick = extract_sheet(wb["Sick Leave 2025 - 2027"], args.as_of)

    # Index sick by normalized name
    sick_by_norm = {
        normalize(name): bal for name, bal in sick["balances"].items()
    }

    people = []
    for excel_name, annual_bal in annual["balances"].items():
        n = normalize(excel_name)
        people.append(
            {
                "excelName": excel_name,
                "name": re.sub(r"^(Mrs?|Miss|Ms)\.?\s+", "", excel_name, flags=re.I).strip(),
                "normalized": n,
                "annual": annual_bal,
                "sick": sick_by_norm.get(n),
                "family": None,
            }
        )

    payload = {
        "asOf": args.as_of,
        "source": path.name,
        "extractedAt": datetime.utcnow().isoformat() + "Z",
        "annualDueLabel": annual["due_label"],
        "sickDueLabel": sick["due_label"],
        "people": people,
        "stats": {
            "annualColumns": len(annual["balances"]),
            "annualWithValue": sum(1 for v in annual["balances"].values() if v is not None),
            "sickWithValue": sum(1 for v in sick["balances"].values() if v is not None),
        },
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {out} ({payload['stats']})")
    wb.close()


if __name__ == "__main__":
    main()
