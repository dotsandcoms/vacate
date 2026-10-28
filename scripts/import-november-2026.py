#!/usr/bin/env python3
"""Preview or atomically apply the approved 1 November 2026 workbook load.

Requires openpyxl. Preview never writes to Supabase. The apply mode first
captures a private backup and then invokes the service-role-only transaction.
"""
import argparse
import json
import os
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import openpyxl

AS_OF = "2026-11-01"


def money(value):
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def number(value):
    return None if value is None else float(money(value))


def load_env():
    env = Path(".env.local")
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def workbook_rows(path):
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = workbook["Leave app load (Brad)"]
    rows = [list(row) for row in sheet.iter_rows(min_row=5, values_only=True) if row[0] is not None]
    workbook.close()
    if len(rows) != 164 or len({str(r[0]).strip() for r in rows}) != 164:
        raise ValueError("Expected 164 unique employee numbers in the load sheet")
    total_days = sum((money(r[12]) for r in rows if r[12] is not None), Decimal(0))
    total_value = sum((money(r[13]) for r in rows if r[13] is not None), Decimal(0))
    if total_days != Decimal("2333.71") or total_value != Decimal("1541224.72"):
        raise ValueError(f"Workbook control totals differ: {total_days} days, R{total_value}")
    result = []
    held = []
    for row in rows:
        code = str(row[0]).strip()
        if code == "NP-TBC" and row[12] is None:
            held.append({"employee_no": code, "name": row[1], "reason": "Code, start date and opening balance require confirmation"})
            continue
        if any(row[i] is None for i in (0, 1, 2, 3, 5, 6, 12)):
            raise ValueError(f"Required data missing for {code}")
        result.append({
            "employee_no": code,
            "name": str(row[1]).strip(),
            "department": str(row[2]).strip(),
            "role": str(row[3]).strip(),
            "annual_entitlement": number(row[5]),
            "monthly_accrual": number(row[6]),
            "daily_cost_r": number(row[7]),
            "opening_annual_balance": number(row[12]),
            "opening_sick_balance": number(30 - (row[14] or 0)),
            "opening_family_balance": number(3 - (row[15] or 0)),
        })
    if len(result) != 163 or len(held) != 1:
        raise ValueError("Unexpected incomplete or held employee rows")
    return result, held


def api(path, method="GET", body=None):
    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    req = Request(url + "/rest/v1/" + path, method=method,
                  data=None if body is None else json.dumps(body).encode(),
                  headers={"apikey": key, "Authorization": "Bearer " + key,
                           "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urlopen(req, timeout=45) as response:
            data = response.read()
            return json.loads(data) if data else None
    except HTTPError as exc:
        raise RuntimeError(f"Supabase request failed ({exc.code}): {exc.read().decode()[:500]}") from exc


def read_all(table):
    result = []
    for offset in range(0, 100000, 1000):
        batch = api(f"{table}?select=*&limit=1000&offset={offset}")
        result.extend(batch)
        if len(batch) < 1000:
            return result
    raise RuntimeError(f"Unexpectedly large {table} table")


def save_backup(include_rates):
    backup = {"captured_at": datetime.now(timezone.utc).isoformat(), "project": "gcbaqynpzicewkcpaevu"}
    tables = ["employees", "leave_requests", "export_batches", "payroll_export_batches",
              "payroll_export_requests", "app_users", "notifications", "notification_reads", "kissflow_sync_snapshots"]
    if include_rates:
        tables.append("employee_leave_rates")
    for table in tables:
        backup[table] = read_all(table)
    directory = Path(".vacate-data/backups")
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    target = directory / f"before-november-openings-{stamp}.json"
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as handle:
        json.dump(backup, handle, indent=2)
    print(f"Backup saved to {target}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup-only", action="store_true")
    args = parser.parse_args()
    if args.apply and args.backup_only:
        raise ValueError("Choose either --apply or --backup-only")
    load_env()
    if "gcbaqynpzicewkcpaevu.supabase.co" not in os.environ.get("NEXT_PUBLIC_SUPABASE_URL", ""):
        raise RuntimeError("Refusing to use a project other than the specified UTF leave project")
    rows, held = workbook_rows(args.xlsx)
    employees = read_all("employees")
    by_no = {str(e["employee_no"]).upper(): e for e in employees}
    if len(by_no) != len(employees):
        raise RuntimeError("Duplicate employee numbers in the live roster")
    if any(r["employee_no"] in by_no and by_no[r["employee_no"]]["name"].lower().strip() != r["name"].lower().strip() for r in rows):
        raise RuntimeError("Employee name differs for a matching code; review before applying")
    codes = {r["employee_no"] for r in rows}
    missing_rates = [{"employee_no": r["employee_no"], "name": r["name"]} for r in rows if r["daily_cost_r"] is None]
    preview = {
        "opening_as_of": AS_OF,
        "source_rows": 164,
        "load_rows": len(rows),
        "opening_days": round(sum(r["opening_annual_balance"] for r in rows), 2),
        "new_staff": [{"employee_no": r["employee_no"], "name": r["name"]} for r in rows if r["employee_no"] not in by_no],
        "deactivate": [{"employee_no": e["employee_no"], "name": e["name"]} for e in employees if e.get("active") is not False and e["employee_no"] not in codes],
        "held": held,
        "missing_rates": missing_rates,
        "accrual_rates": dict(Counter(str(r["monthly_accrual"]) for r in rows)),
        "mode": "apply" if args.apply else "backup" if args.backup_only else "preview",
    }
    print(json.dumps(preview, indent=2))
    if args.backup_only:
        save_backup(include_rates=False)
        return
    if not args.apply:
        return

    # Abort before any mutation if schema or backup inputs are unavailable.
    save_backup(include_rates=True)
    result = api("rpc/apply_november_2026_openings", "POST", {"payload": {"employees": rows}})
    if result.get("loaded") != len(rows):
        raise RuntimeError(f"Unexpected import result: {result}")
    after = read_all("employees")
    rates = {r["employee_id"]: r["daily_cost_r"] for r in read_all("employee_leave_rates")}
    active = {r["employee_no"]: r for r in after if r.get("active") is not False}
    if set(active) != codes:
        raise RuntimeError("Post-import active roster does not match the preview")
    for row in rows:
        current = active[row["employee_no"]]
        fields = ("annual_entitlement", "monthly_accrual", "opening_annual_balance", "opening_sick_balance", "opening_family_balance")
        if any(number(current.get(key)) != row[key] for key in fields):
            raise RuntimeError(f"Post-import balance mismatch for {row['employee_no']}")
        if current.get("opening_balance_as_of") != AS_OF or number(rates.get(current["id"])) != row["daily_cost_r"]:
            raise RuntimeError(f"Post-import date or rate mismatch for {row['employee_no']}")
    print(json.dumps({"verified_active": len(active), "verified_opening_days": preview["opening_days"], "missing_rates": len(missing_rates)}))


if __name__ == "__main__":
    main()
