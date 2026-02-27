import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';

const CRON_SECRET = process.env.CRON_SECRET;

// GET /api/cron/generate-tasks
// CRON: 定期タスクテンプレートに基づきタスクを自動生成
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const templates = await prisma.taskTemplate.findMany({
      where: { isActive: true },
    });

    if (templates.length === 0) {
      return NextResponse.json({ message: '有効なテンプレートがありません', created: 0 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDayOfWeek = today.getDay(); // 0=日, 1=月, ..., 6=土
    const todayDate = today.getDate(); // 1-31
    const todayMonth = today.getMonth() + 1; // 1-12
    const todayStr = `${String(todayMonth).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`; // "03-15" 形式

    let totalCreated = 0;

    for (const tmpl of templates) {
      // 本日生成すべきかチェック
      if (!shouldGenerateToday(tmpl, todayDayOfWeek, todayDate, todayStr, today)) {
        continue;
      }

      // 同日に同テンプレートから生成済みかチェック
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const existingToday = await prisma.task.findFirst({
        where: {
          templateId: tmpl.id,
          createdAt: { gte: today, lt: tomorrow },
        },
      });
      if (existingToday) continue;

      // 担当者情報を解析
      const employeeIds = (tmpl.targetEmployeeIds as number[]) || [];
      const departmentIds = (tmpl.targetDepartmentIds as number[]) || [];
      const branchIds = (tmpl.targetBranchIds as number[]) || [];

      if (tmpl.completionRule === 'SHARED') {
        // SHARED: 1つのタスクを作成し、複数担当者を紐付け
        await prisma.$transaction(async (tx) => {
          const task = await tx.task.create({
            data: {
              title: tmpl.title,
              description: tmpl.description,
              dueDate: today,
              priority: tmpl.priority,
              status: 'PENDING',
              category: tmpl.category,
              customerId: tmpl.customerId,
              branchId: tmpl.branchId,
              scheduleId: tmpl.scheduleId,
              templateId: tmpl.id,
              assigneeId: employeeIds.length === 1 ? employeeIds[0] : null,
            },
          });

          // TaskAssignee に担当者を登録
          const assigneeData = [
            ...employeeIds.map((eid) => ({ taskId: task.id, employeeId: eid, departmentId: null, branchId: null })),
            ...departmentIds.map((did) => ({ taskId: task.id, employeeId: null, departmentId: did, branchId: null })),
            ...branchIds.map((bid) => ({ taskId: task.id, employeeId: null, departmentId: null, branchId: bid })),
          ];
          if (assigneeData.length > 0) {
            await tx.taskAssignee.createMany({ data: assigneeData });
          }

          totalCreated++;
        });
      } else {
        // INDIVIDUAL: 対象社員を展開して個別タスクを作成
        const targetEmployees = new Set<number>(employeeIds);

        // 部署から社員を展開
        if (departmentIds.length > 0) {
          const deptEmployees = await prisma.employee.findMany({
            where: { departmentId: { in: departmentIds }, isActive: true },
            select: { id: true },
          });
          deptEmployees.forEach((e) => targetEmployees.add(e.id));
        }

        // 支店から社員を展開
        if (branchIds.length > 0) {
          const branchEmployees = await prisma.employee.findMany({
            where: { branchId: { in: branchIds }, isActive: true },
            select: { id: true },
          });
          branchEmployees.forEach((e) => targetEmployees.add(e.id));
        }

        // 各社員ごとにタスク作成
        for (const empId of targetEmployees) {
          await prisma.task.create({
            data: {
              title: tmpl.title,
              description: tmpl.description,
              dueDate: today,
              priority: tmpl.priority,
              status: 'PENDING',
              category: tmpl.category,
              customerId: tmpl.customerId,
              branchId: tmpl.branchId,
              scheduleId: tmpl.scheduleId,
              templateId: tmpl.id,
              assigneeId: empId,
            },
          });
          totalCreated++;
        }
      }

      // lastGeneratedAt を更新
      await prisma.taskTemplate.update({
        where: { id: tmpl.id },
        data: { lastGeneratedAt: new Date() },
      });
    }

    // 監査ログ
    if (totalCreated > 0) {
      await writeAuditLog({
        actorType: 'SYSTEM',
        action: 'CREATE',
        targetModel: 'Task',
        description: `CRON定期タスク生成: ${totalCreated}件のタスクを作成`,
      });
    }

    return NextResponse.json({
      success: true,
      created: totalCreated,
      message: `${totalCreated}件のタスクを作成しました`,
    });
  } catch (error) {
    console.error('CRON Generate Tasks Error:', error);
    return NextResponse.json({ error: 'タスク自動生成に失敗しました' }, { status: 500 });
  }
}

// テンプレートの recurrenceType/Value と本日を比較して生成すべきか判定
function shouldGenerateToday(
  tmpl: any,
  todayDayOfWeek: number,
  todayDate: number,
  todayStr: string,
  today: Date
): boolean {
  switch (tmpl.recurrenceType) {
    case 'ONCE':
      return !tmpl.lastGeneratedAt;

    case 'DAILY':
      return true;

    case 'WEEKLY': {
      // recurrenceValue = "1,3,5" (月,水,金)
      if (!tmpl.recurrenceValue) return false;
      const days = tmpl.recurrenceValue.split(',').map((s: string) => parseInt(s.trim()));
      return days.includes(todayDayOfWeek);
    }

    case 'MONTHLY': {
      // recurrenceValue = "15" (15日)
      if (!tmpl.recurrenceValue) return false;
      const targetDate = parseInt(tmpl.recurrenceValue.trim());
      return todayDate === targetDate;
    }

    case 'YEARLY': {
      // recurrenceValue = "03-15" (3月15日)
      if (!tmpl.recurrenceValue) return false;
      return todayStr === tmpl.recurrenceValue.trim();
    }

    default:
      return false;
  }
}
