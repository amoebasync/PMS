import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

/**
 * POST /api/distributor-payroll/fill-excel
 * FormData: file (xlsx), password, weekStart
 * → Excelにデータを差し込んで返す
 */
export async function POST(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const tmpDir = '/tmp/payroll-fill';
  let inputPath = '', jsonPath = '', outputPath = '';

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const password = formData.get('password') as string || '';
    const weekStart = formData.get('weekStart') as string || '';

    if (!file || !password || !weekStart) {
      return NextResponse.json({ error: 'file, password, weekStart は必須です' }, { status: 400 });
    }

    // Parse weekStart
    const periodStart = new Date(weekStart);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 6);
    periodEnd.setHours(23, 59, 59, 999);

    // Fetch payroll records
    const records = await prisma.distributorPayrollRecord.findMany({
      where: { periodStart },
      include: {
        distributor: { select: { id: true, staffId: true, name: true } },
        items: { orderBy: { date: 'asc' } },
      },
    });

    // Fetch expenses
    const distIds = records.map(r => r.distributor.id);
    const expenses = distIds.length > 0 ? await prisma.distributorExpense.findMany({
      where: {
        distributorId: { in: distIds },
        date: { gte: periodStart, lte: periodEnd },
        status: { in: ['APPROVED', 'PENDING'] },
      },
      select: { distributorId: true, date: true, amount: true },
    }) : [];

    // Build payroll JSON for Python script
    const weekDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(periodStart);
      d.setDate(d.getDate() + i);
      weekDays.push(d.toISOString().split('T')[0]);
    }

    const distributors = records
      .sort((a, b) => a.distributor.staffId.localeCompare(b.distributor.staffId))
      .map(r => {
        const dailyEarnings: Record<string, number> = {};
        for (const day of weekDays) {
          dailyEarnings[day] = r.items
            .filter(it => it.date.toISOString().split('T')[0] === day)
            .reduce((s, it) => s + it.earnedAmount, 0);
        }

        const dailyExpenses: Record<string, number> = {};
        const distExpenses = expenses.filter(e => e.distributorId === r.distributor.id);
        for (const e of distExpenses) {
          const dateKey = e.date.toISOString().split('T')[0];
          dailyExpenses[dateKey] = (dailyExpenses[dateKey] || 0) + e.amount;
        }

        return {
          staffId: r.distributor.staffId,
          name: r.distributor.name,
          dailyEarnings,
          dailyExpenses,
          schedulePay: r.schedulePay,
          expensePay: r.expensePay,
          grossPay: r.grossPay,
        };
      });

    const payrollData = { weekStart, distributors };

    // Write temp files
    await mkdir(tmpDir, { recursive: true });
    const ts = Date.now();
    inputPath = path.join(tmpDir, `input-${ts}.xlsx`);
    jsonPath = path.join(tmpDir, `data-${ts}.json`);
    outputPath = path.join(tmpDir, `output-${ts}.xlsx`);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, fileBuffer);
    await writeFile(jsonPath, JSON.stringify(payrollData, null, 2), 'utf-8');

    // Run Python script
    const scriptPath = path.join(process.cwd(), 'scripts', 'fill-payroll-excel.py');
    const { stdout, stderr } = await execFileAsync('python3', [
      scriptPath, inputPath, password, jsonPath, outputPath,
    ], { timeout: 30000 });

    if (stderr) {
      console.error('[fill-excel] Python stderr:', stderr);
    }

    // Parse Python output
    let result: any = {};
    try {
      result = JSON.parse(stdout.trim());
    } catch {
      return NextResponse.json({ error: 'スクリプト実行エラー', detail: stdout }, { status: 500 });
    }

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Read output file
    const outputBuffer = await readFile(outputPath);

    // Clean up temp files
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      unlink(jsonPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
    ]);

    // Return file + metadata as multipart? No, return file with metadata in headers
    const fileName = `給与入力済_${weekStart}.xlsx`;
    const response = new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'X-Payroll-Result': encodeURIComponent(JSON.stringify(result)),
      },
    });

    return response;
  } catch (err: any) {
    console.error('[fill-excel] Error:', err);
    // Clean up on error
    await Promise.all([
      inputPath && unlink(inputPath).catch(() => {}),
      jsonPath && unlink(jsonPath).catch(() => {}),
      outputPath && unlink(outputPath).catch(() => {}),
    ]);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}

export const config = {
  api: { bodyParser: false },
};
