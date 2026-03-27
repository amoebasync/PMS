import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, employee } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const inspectionId = parseInt(id, 10);
    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const inspection = await prisma.fieldInspection.findUnique({
      where: { id: inspectionId },
      include: {
        distributor: { select: { name: true } },
        inspector: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        schedule: {
          include: {
            area: {
              include: {
                prefecture: true,
                city: true,
              },
            },
          },
        },
      },
    });

    if (!inspection) {
      return NextResponse.json({ error: '検査が見つかりません' }, { status: 404 });
    }

    if (inspection.status !== 'COMPLETED') {
      return NextResponse.json({ error: '完了済みの検査のみタスクを作成できます' }, { status: 400 });
    }

    if (inspection.followUpTaskId) {
      return NextResponse.json({ error: 'フォローアップタスクは既に作成されています' }, { status: 400 });
    }

    const body = await request.json();
    const { note, dueDate, assigneeId } = body;

    if (!note) {
      return NextResponse.json({ error: 'noteは必須です' }, { status: 400 });
    }

    const area = inspection.schedule?.area;
    const areaName = area
      ? `${area.prefecture?.name || ''}${area.city?.name || ''}${area.chome_name || area.town_name || ''}`
      : '';

    const distributorName = inspection.distributor?.name || '不明';

    // Default due date: tomorrow 23:59:59.999
    let taskDueDate: Date;
    if (dueDate) {
      taskDueDate = new Date(dueDate);
    } else {
      taskDueDate = new Date();
      taskDueDate.setDate(taskDueDate.getDate() + 1);
      taskDueDate.setHours(23, 59, 59, 999);
    }

    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          title: `[フォローアップ] ${distributorName} - ${areaName}`,
          description: note,
          priority: 'HIGH',
          status: 'PENDING',
          dueDate: taskDueDate,
          assigneeId: assigneeId || inspection.inspector.id,
          createdById: employee!.id,
        },
      });

      const updatedInspection = await tx.fieldInspection.update({
        where: { id: inspectionId },
        data: {
          followUpRequired: true,
          followUpNote: note,
          followUpTaskId: task.id,
        },
      });

      return { task, inspection: updatedInspection };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('Follow-up task creation error:', err);
    return NextResponse.json({ error: 'タスクの作成に失敗しました' }, { status: 500 });
  }
}
