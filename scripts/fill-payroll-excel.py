#!/usr/bin/env python3
"""
配布員給与データをExcelテンプレートに差し込むスクリプト

Usage: python3 fill-payroll-excel.py <input_xlsx> <password> <payroll_json> <output_xlsx>
"""

import sys
import json
import io
import msoffcrypto
import openpyxl
from openpyxl.styles import PatternFill, Font
from datetime import datetime, timedelta
from copy import copy

ALERT_THRESHOLD_RATE = 0.2
ALERT_THRESHOLD_ABS = 2000
ALERT_FILL = PatternFill(start_color="FFFECACA", end_color="FFFECACA", fill_type="solid")
NEW_STAFF_FILL = PatternFill(start_color="FFE0F2FE", end_color="FFE0F2FE", fill_type="solid")
ZERO_FILL = PatternFill(start_color="FFFF99CC", end_color="FFFF99CC", fill_type="solid")
HAS_DATA_FILL = PatternFill(start_color="FF99CCFF", end_color="FF99CCFF", fill_type="solid")
HEADER_FONT = Font(bold=True, size=9)


def decrypt_workbook(path, password, tmp_path=None):
    with open(path, "rb") as f:
        decrypted = io.BytesIO()
        ms = msoffcrypto.OfficeFile(f)
        ms.load_key(password=password)
        ms.decrypt(decrypted)
    # decrypt後に一度ファイルに保存→再読み込みしないと大量のfill変更が保存時に消えるバグがある
    import tempfile, os
    tmp = tmp_path or tempfile.mktemp(suffix=".xlsx")
    wb_raw = openpyxl.load_workbook(decrypted)
    wb_raw.save(tmp)
    wb_raw.close()
    wb = openpyxl.load_workbook(tmp)
    os.unlink(tmp)
    return wb


def find_target_sheet(wb, week_start_date):
    year = week_start_date.year
    month = week_start_date.month
    candidates = []
    for name in wb.sheetnames:
        if f"{year}年{month}月" in name:
            candidates.append(name)
        week_end = week_start_date + timedelta(days=6)
        if f"{year}年{week_end.month}月" in name and name not in candidates:
            candidates.append(name)
    for c in candidates:
        if "一般" in c:
            return c
    return candidates[0] if candidates else None


def find_week_block(ws, week_start_date):
    target_date = week_start_date.date()
    for r in range(1, ws.max_row + 1):
        val = ws.cell(r, 1).value
        if val is None:
            continue
        if hasattr(val, 'date'):
            cell_date = val.date()
        elif hasattr(val, 'year'):
            cell_date = val
        else:
            continue
        if cell_date == target_date:
            return r
    return None


def find_staff_columns(ws, staff_code_row=20):
    staff_map = {}
    max_used_col = 1
    for c in range(2, ws.max_column + 1):
        val = ws.cell(staff_code_row, c).value
        if val and str(val).strip():
            staff_map[str(val).strip()] = c
            max_used_col = c
    return staff_map, max_used_col


def copy_column_style(ws, source_col, target_col, rows):
    for r in rows:
        src = ws.cell(r, source_col)
        tgt = ws.cell(r, target_col)
        if src.has_style:
            tgt.font = copy(src.font)
            tgt.border = copy(src.border)
            tgt.number_format = src.number_format
            tgt.alignment = copy(src.alignment)


def main():
    if len(sys.argv) != 5:
        print("Usage: fill-payroll-excel.py <input> <password> <payroll_json> <output>", file=sys.stderr)
        sys.exit(1)

    input_path, password, json_path, output_path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    week_start = datetime.strptime(data["weekStart"], "%Y-%m-%d")
    distributors = data["distributors"]

    wb = decrypt_workbook(input_path, password)

    sheet_name = find_target_sheet(wb, week_start)
    if not sheet_name:
        print(json.dumps({"error": f"シートが見つかりません: {week_start.year}年{week_start.month}月"}))
        sys.exit(0)

    ws = wb[sheet_name]

    block_start = find_week_block(ws, week_start)
    if not block_start:
        print(json.dumps({"error": f"週ブロックが見つかりません: {data['weekStart']}"}))
        sys.exit(0)

    # 小計・交通費・合計の行位置
    expense_row = block_start + 11       # 交通費（経費）
    total_row = block_start + 22         # 合計
    # ※ 小計行 (block_start + 7, +8) は SUM関数が入っているので触らない

    staff_cols, max_used_col = find_staff_columns(ws)

    alerts = []
    new_staff = []
    updated_count = 0

    week_dates = [(week_start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]

    # --- Phase 1: 新規スタッフを最後の列に追加 ---
    new_staff_ids = [d["staffId"] for d in distributors if d["staffId"] not in staff_cols]
    new_staff_ids.sort()

    next_col = max_used_col + 1
    for new_id in new_staff_ids:
        col = next_col
        staff_cols[new_id] = col
        new_staff.append(new_id)

        # ヘッダー書き込み
        dist_data = next((d for d in distributors if d["staffId"] == new_id), None)
        ws.cell(20, col).value = new_id
        ws.cell(20, col).font = HEADER_FONT
        ws.cell(20, col).fill = NEW_STAFF_FILL
        if dist_data:
            ws.cell(21, col).value = dist_data["name"]
            ws.cell(21, col).font = HEADER_FONT
            ws.cell(21, col).fill = NEW_STAFF_FILL

        # 前の列のスタイルをコピー
        all_rows = list(range(block_start, block_start + 23))
        copy_column_style(ws, max_used_col, col, all_rows)

        next_col += 1

    # --- Phase 2: データ差し込み + セル色設定 ---
    for dist in distributors:
        staff_id = dist["staffId"]
        col = staff_cols.get(staff_id)
        if col is None:
            continue

        daily_earnings = dist.get("dailyEarnings", {})
        expense_pay = dist.get("expensePay", 0)
        gross_pay = dist.get("grossPay", 0)

        # 7日間の合計が0かどうか判定
        total_week_earnings = sum(daily_earnings.get(d, 0) for d in week_dates)
        is_zero_week = total_week_earnings == 0

        # 日別セルの処理
        for day_idx, date_str in enumerate(week_dates):
            r = block_start + day_idx
            new_val = daily_earnings.get(date_str, 0)

            old_val = ws.cell(r, col).value
            old_num = 0
            if old_val is not None:
                try:
                    old_num = float(old_val)
                except (ValueError, TypeError):
                    old_num = 0

            # セル色設定
            if is_zero_week:
                ws.cell(r, col).fill = ZERO_FILL       # ピンク: 7日間0円
            else:
                ws.cell(r, col).fill = HAS_DATA_FILL    # 水色: 金額あり

            # 金額差異アラート（アラート色が優先）
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

            # 値の書き込み
            ws.cell(r, col).value = new_val

        # 交通費
        ws.cell(expense_row, col).value = expense_pay

        # 合計
        ws.cell(total_row, col).value = gross_pay

        # ※ 小計行は SUM関数のまま触らない

        updated_count += 1

    # --- Phase 3: 全スタッフ列の日付セル色を設定（PMS対象外の列も含む） ---
    # PMS対象スタッフ（Phase 2で処理済み）はスキップ
    pms_staff_ids = set(d["staffId"] for d in distributors)
    for sid, col in staff_cols.items():
        if sid in pms_staff_ids:
            continue  # Phase 2で色設定済み
        # スタッフコードっぽくない値はスキップ
        if not any(sid.startswith(p) for p in ("MBF", "MSF", "MYF", "NAI", "MNA", "MKI", "TOD", "B0")):
            continue
        # エクセル上の7日間の値を確認
        week_total = 0
        for day_idx in range(7):
            r = block_start + day_idx
            val = ws.cell(r, col).value
            if val is not None:
                try:
                    week_total += float(val)
                except (ValueError, TypeError):
                    pass
        # 0円ならピンク、金額ありなら水色
        fill = ZERO_FILL if week_total == 0 else HAS_DATA_FILL
        for day_idx in range(7):
            r = block_start + day_idx
            try:
                ws.cell(r, col).fill = fill
            except (ValueError, TypeError):
                pass  # スタイル設定できないセルはスキップ

    wb.save(output_path)

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
