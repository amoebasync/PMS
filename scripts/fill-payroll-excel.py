#!/usr/bin/env python3
"""
配布員給与データをExcelテンプレートに差し込むスクリプト

Usage: python3 fill-payroll-excel.py <input_xlsx> <password> <payroll_json> <output_xlsx>

payroll_json format:
{
  "weekStart": "2026-03-15",
  "distributors": [
    {
      "staffId": "MBF1043",
      "name": "Brian Kayemba",
      "dailyEarnings": { "2026-03-15": 0, "2026-03-16": 16000, ... },
      "dailyExpenses": { "2026-03-16": 770, ... },
      "schedulePay": 112229,
      "expensePay": 7372,
      "grossPay": 119601
    }
  ]
}
"""

import sys
import json
import io
import msoffcrypto
import openpyxl
from openpyxl.styles import PatternFill, Font
from datetime import datetime, timedelta
from copy import copy

ALERT_THRESHOLD_RATE = 0.2   # 20% difference
ALERT_THRESHOLD_ABS = 2000   # or ¥2000 absolute difference
ALERT_FILL = PatternFill(start_color="FFFECACA", end_color="FFFECACA", fill_type="solid")  # light red
NEW_STAFF_FILL = PatternFill(start_color="FFE0F2FE", end_color="FFE0F2FE", fill_type="solid")  # light blue
HEADER_FONT = Font(bold=True, size=9)


def decrypt_workbook(path, password):
    with open(path, "rb") as f:
        buf = io.BytesIO()
        ms = msoffcrypto.OfficeFile(f)
        ms.load_key(password=password)
        ms.decrypt(buf)
    return openpyxl.load_workbook(buf)


def find_target_sheet(wb, week_start_date):
    """Find the sheet for the month containing the week start date"""
    year = week_start_date.year
    month = week_start_date.month

    candidates = []
    for name in wb.sheetnames:
        if f"{year}年{month}月" in name:
            candidates.append(name)
        # Also check if the month spans (e.g., week starts in Feb but sheet is March)
        week_end = week_start_date + timedelta(days=6)
        if f"{year}年{week_end.month}月" in name and name not in candidates:
            candidates.append(name)

    # Prefer sheet with "一般" in name
    for c in candidates:
        if "一般" in c:
            return c
    if candidates:
        return candidates[0]
    return None


def find_week_block(ws, week_start_date):
    """Find the row range for the week block matching the given start date"""
    # Scan column A for date values matching the week's Sunday
    target_dates = []
    for i in range(7):
        d = week_start_date + timedelta(days=i)
        target_dates.append(d.date())

    for r in range(1, ws.max_row + 1):
        val = ws.cell(r, 1).value
        if val is None:
            continue
        # Could be datetime or date
        if hasattr(val, 'date'):
            cell_date = val.date()
        elif hasattr(val, 'year'):
            cell_date = val
        else:
            continue

        if cell_date == target_dates[0]:
            # Found the start of the week block
            # Verify next 6 rows are the remaining days
            return r

    return None


def find_staff_columns(ws, staff_code_row=20):
    """Map staffId -> column number"""
    staff_map = {}
    for c in range(2, ws.max_column + 1):
        val = ws.cell(staff_code_row, c).value
        if val and str(val).strip():
            staff_map[str(val).strip()] = c
    return staff_map


def copy_cell_style(source_col, target_col, ws, rows):
    """Copy cell styles from source column to target column"""
    for r in rows:
        src = ws.cell(r, source_col)
        tgt = ws.cell(r, target_col)
        if src.has_style:
            tgt.font = copy(src.font)
            tgt.border = copy(src.border)
            tgt.fill = copy(src.fill)
            tgt.number_format = src.number_format
            tgt.alignment = copy(src.alignment)


def main():
    if len(sys.argv) != 5:
        print("Usage: fill-payroll-excel.py <input> <password> <payroll_json> <output>", file=sys.stderr)
        sys.exit(1)

    input_path, password, json_path, output_path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

    # Load payroll data
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    week_start = datetime.strptime(data["weekStart"], "%Y-%m-%d")
    distributors = data["distributors"]

    # Decrypt and load workbook
    wb = decrypt_workbook(input_path, password)

    # Find target sheet
    sheet_name = find_target_sheet(wb, week_start)
    if not sheet_name:
        print(json.dumps({"error": f"シートが見つかりません: {week_start.year}年{week_start.month}月"}))
        sys.exit(0)

    ws = wb[sheet_name]

    # Find week block
    block_start = find_week_block(ws, week_start)
    if not block_start:
        print(json.dumps({"error": f"週ブロックが見つかりません: {data['weekStart']}"}))
        sys.exit(0)

    # Summary rows relative to block start
    subtotal_row = block_start + 7       # 小計 (1st)
    expense_row = block_start + 11       # 交通費（経費）
    total_row = block_start + 22         # 合計

    # Find staff columns
    staff_cols = find_staff_columns(ws)

    alerts = []
    new_staff = []
    updated_count = 0

    # Build week dates
    week_dates = [(week_start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]

    # Process each distributor from PMS
    for dist in distributors:
        staff_id = dist["staffId"]
        col = staff_cols.get(staff_id)

        if col is None:
            # New staff - add column
            # Find the last used column and add after it
            max_col = max(staff_cols.values()) if staff_cols else 1
            col = max_col + 1
            staff_cols[staff_id] = col
            new_staff.append(staff_id)

            # Write header info
            ws.cell(20, col).value = staff_id
            ws.cell(20, col).font = HEADER_FONT
            ws.cell(20, col).fill = NEW_STAFF_FILL
            ws.cell(21, col).value = dist["name"]
            ws.cell(21, col).font = HEADER_FONT
            ws.cell(21, col).fill = NEW_STAFF_FILL

            # Copy style from previous column for all relevant rows
            if max_col > 1:
                all_rows = list(range(block_start, block_start + 23))
                copy_cell_style(max_col, col, ws, all_rows)

        daily_earnings = dist.get("dailyEarnings", {})
        daily_expenses = dist.get("dailyExpenses", {})

        # Fill daily earnings
        for day_idx, date_str in enumerate(week_dates):
            r = block_start + day_idx
            new_val = daily_earnings.get(date_str, 0)

            if new_val == 0:
                continue

            old_val = ws.cell(r, col).value
            old_num = 0
            if old_val is not None:
                try:
                    old_num = float(old_val)
                except (ValueError, TypeError):
                    old_num = 0

            # Check for significant difference
            if old_num > 0 and new_val > 0:
                diff = abs(new_val - old_num)
                rate = diff / old_num if old_num != 0 else 0
                if diff >= ALERT_THRESHOLD_ABS or rate >= ALERT_THRESHOLD_RATE:
                    alerts.append({
                        "staffId": staff_id,
                        "name": dist["name"],
                        "date": date_str,
                        "old": int(old_num),
                        "new": int(new_val),
                        "diff": int(new_val - old_num),
                    })
                    ws.cell(r, col).fill = ALERT_FILL

            ws.cell(r, col).value = new_val

        # Fill subtotal (小計 - schedule pay)
        schedule_pay = dist.get("schedulePay", 0)
        if schedule_pay > 0:
            old_sub = ws.cell(subtotal_row, col).value
            old_sub_num = 0
            if old_sub is not None:
                try:
                    old_sub_num = float(old_sub)
                except (ValueError, TypeError):
                    old_sub_num = 0

            if old_sub_num > 0 and schedule_pay > 0:
                diff = abs(schedule_pay - old_sub_num)
                rate = diff / old_sub_num if old_sub_num != 0 else 0
                if diff >= ALERT_THRESHOLD_ABS or rate >= ALERT_THRESHOLD_RATE:
                    alerts.append({
                        "staffId": staff_id,
                        "name": dist["name"],
                        "date": "小計",
                        "old": int(old_sub_num),
                        "new": int(schedule_pay),
                        "diff": int(schedule_pay - old_sub_num),
                    })
                    ws.cell(subtotal_row, col).fill = ALERT_FILL

            ws.cell(subtotal_row, col).value = schedule_pay

        # Fill expense
        expense_pay = dist.get("expensePay", 0)
        if expense_pay > 0:
            ws.cell(expense_row, col).value = expense_pay

        # Fill total (合計)
        gross_pay = dist.get("grossPay", 0)
        if gross_pay > 0:
            ws.cell(total_row, col).value = gross_pay

        updated_count += 1

    # Save without password (decrypted)
    wb.save(output_path)

    # Output result as JSON
    result = {
        "success": True,
        "sheet": sheet_name,
        "weekBlock": f"Row {block_start}-{block_start + 22}",
        "updated": updated_count,
        "newStaff": new_staff,
        "alerts": alerts,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
