import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { haversineDistance } from '@/lib/geo-utils';

async function authorize() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) return null;
  return prisma.employee.findUnique({ where: { id: parseInt(sessionId) } });
}

type Priority = 'COLLECTION_FIRST' | 'RELAY_FIRST' | 'TIME_OPTIMAL';

interface TaskWithCoords {
  task: any;
  lat: number;
  lng: number;
  timeSlotStart: string | null;
}

interface OptimizedTask {
  task: any;
  sequenceNumber: number;
  legDistance: number;
  legDuration: number;
  estimatedArrival: string | null;
  isTimeConstrained: boolean;
}

/**
 * nearest-neighbor で時間指定タスクを固定位置に配置し、
 * 時間指定なしタスクを最適な順序で挿入する
 */
function optimizeGroup(tasks: TaskWithCoords[]): TaskWithCoords[] {
  if (tasks.length <= 1) return tasks;

  const timeTasks = tasks
    .filter(t => t.timeSlotStart !== null)
    .sort((a, b) => a.timeSlotStart!.localeCompare(b.timeSlotStart!));

  const freeTasks = tasks.filter(t => t.timeSlotStart === null);
  const freeRemaining = [...freeTasks];

  const result: TaskWithCoords[] = [];

  // 時間指定タスクを固定順に並べ、間に nearest-neighbor でフリータスクを挿入
  let currentLat: number;
  let currentLng: number;

  // 起点を決定: 最初の時間指定タスク、なければ最初のフリータスク
  if (timeTasks.length > 0) {
    currentLat = timeTasks[0].lat;
    currentLng = timeTasks[0].lng;
  } else if (freeRemaining.length > 0) {
    currentLat = freeRemaining[0].lat;
    currentLng = freeRemaining[0].lng;
  } else {
    return tasks;
  }

  let timeIndex = 0;

  while (timeIndex < timeTasks.length || freeRemaining.length > 0) {
    // 次の時間指定タスクがある場合、フリータスクを間に入れるか判定
    if (timeIndex < timeTasks.length) {
      // フリータスクが残っていて、次の時間指定タスクより近いフリータスクがあるなら挿入
      if (freeRemaining.length > 0) {
        const nextTimeDist = haversineDistance(
          currentLat, currentLng,
          timeTasks[timeIndex].lat, timeTasks[timeIndex].lng,
        );

        const nearestFreeIdx = findNearestIndex(freeRemaining, currentLat, currentLng);
        const nearestFreeDist = haversineDistance(
          currentLat, currentLng,
          freeRemaining[nearestFreeIdx].lat, freeRemaining[nearestFreeIdx].lng,
        );

        // フリータスクの方が近ければ先に処理
        if (nearestFreeDist < nextTimeDist) {
          const picked = freeRemaining.splice(nearestFreeIdx, 1)[0];
          result.push(picked);
          currentLat = picked.lat;
          currentLng = picked.lng;
          continue;
        }
      }

      // 時間指定タスクを追加
      const timeTask = timeTasks[timeIndex];
      result.push(timeTask);
      currentLat = timeTask.lat;
      currentLng = timeTask.lng;
      timeIndex++;
    } else {
      // 時間指定タスクは全部配置済み、残りのフリータスクを nearest-neighbor で追加
      const nearestIdx = findNearestIndex(freeRemaining, currentLat, currentLng);
      const picked = freeRemaining.splice(nearestIdx, 1)[0];
      result.push(picked);
      currentLat = picked.lat;
      currentLng = picked.lng;
    }
  }

  return result;
}

function findNearestIndex(tasks: TaskWithCoords[], lat: number, lng: number): number {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < tasks.length; i++) {
    const d = haversineDistance(lat, lng, tasks[i].lat, tasks[i].lng);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return minIdx;
}

/**
 * Google Directions API でルート情報を取得
 */
async function fetchDirections(orderedTasks: TaskWithCoords[]): Promise<{
  legs: { distance: number; duration: number }[];
  polyline: string | null;
} | null> {
  if (orderedTasks.length < 2) return null;
  if (orderedTasks.length > 25) return null; // 25地点超はスキップ

  const apiKey = process.env.GOOGLE_DIRECTIONS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const origin = `${orderedTasks[0].lat},${orderedTasks[0].lng}`;
  const destination = `${orderedTasks[orderedTasks.length - 1].lat},${orderedTasks[orderedTasks.length - 1].lng}`;

  let waypointsParam = '';
  if (orderedTasks.length > 2) {
    const mid = orderedTasks.slice(1, -1).map(t => `${t.lat},${t.lng}`).join('|');
    waypointsParam = `&waypoints=${encodeURIComponent(mid)}`;
  }

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypointsParam}&key=${apiKey}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();

    if (data.status !== 'OK' || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const legs = route.legs.map((leg: any) => ({
      distance: leg.distance?.value ?? 0,
      duration: leg.duration?.value ?? 0,
    }));

    return {
      legs,
      polyline: route.overview_polyline?.points ?? null,
    };
  } catch (err) {
    console.error('Directions API error:', err);
    return null;
  }
}

/**
 * Haversine フォールバック: 距離と推定所要時間を計算
 */
function computeHaversineLeg(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): { distance: number; duration: number } {
  const distance = Math.round(haversineDistance(lat1, lng1, lat2, lng2));
  // 30 km/h で推定 (市街地走行)
  const duration = Math.round(distance / (30000 / 3600)); // meters / (m/s)
  return { distance, duration };
}

/**
 * 時刻文字列 "HH:MM" を秒数に変換
 */
function timeToSeconds(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 3600 + m * 60;
}

/**
 * 秒数を "HH:MM" に変換
 */
function secondsToTime(seconds: number): string {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// GET: ルート最適化
export async function GET(request: Request) {
  try {
    if (!await authorize()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const driverId = searchParams.get('driverId');
    const priority = (searchParams.get('priority') || 'TIME_OPTIMAL') as Priority;

    if (!date || !driverId) {
      return NextResponse.json(
        { error: 'date and driverId are required' },
        { status: 400 },
      );
    }

    if (!['COLLECTION_FIRST', 'RELAY_FIRST', 'TIME_OPTIMAL'].includes(priority)) {
      return NextResponse.json(
        { error: 'Invalid priority. Must be COLLECTION_FIRST, RELAY_FIRST, or TIME_OPTIMAL' },
        { status: 400 },
      );
    }

    // RelayTask を取得
    const allTasks = await prisma.relayTask.findMany({
      where: {
        driverId: parseInt(driverId),
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        schedule: { date: new Date(date) },
      },
      include: {
        driver: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        schedule: {
          select: {
            id: true, jobNumber: true, date: true, status: true,
            distributor: { select: { id: true, staffId: true, name: true } },
            branch: { select: { id: true, nameJa: true } },
            area: {
              select: {
                id: true, chome_name: true,
                prefecture: { select: { name: true } },
                city: { select: { name: true } },
              },
            },
            items: { select: { id: true, flyerName: true, plannedCount: true, actualCount: true } },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    // 座標あり/なしに分離
    const withCoords: TaskWithCoords[] = [];
    const skippedTasks: any[] = [];

    for (const task of allTasks) {
      if (task.latitude != null && task.longitude != null) {
        withCoords.push({
          task,
          lat: task.latitude,
          lng: task.longitude,
          timeSlotStart: task.timeSlotStart,
        });
      } else {
        skippedTasks.push(task);
      }
    }

    if (withCoords.length === 0) {
      return NextResponse.json({
        optimizedTasks: [],
        totalDistance: 0,
        totalDuration: 0,
        polylineEncoded: null,
        skippedTasks,
      });
    }

    // 優先度に応じてグループ分け & 最適化
    let optimized: TaskWithCoords[];

    if (priority === 'TIME_OPTIMAL') {
      optimized = optimizeGroup(withCoords);
    } else {
      const isCollectionFirst = priority === 'COLLECTION_FIRST';
      const collectionTasks = withCoords.filter(t => t.task.type === 'COLLECTION');
      const relayTasks = withCoords.filter(t => t.task.type === 'RELAY' || t.task.type === 'FULL_RELAY');

      const firstGroup = isCollectionFirst ? collectionTasks : relayTasks;
      const secondGroup = isCollectionFirst ? relayTasks : collectionTasks;

      const optimizedFirst = optimizeGroup(firstGroup);
      const optimizedSecond = optimizeGroup(secondGroup);
      optimized = [...optimizedFirst, ...optimizedSecond];
    }

    // Directions API でルート情報取得
    const directions = await fetchDirections(optimized);

    // legDistance / legDuration を計算
    const legs: { distance: number; duration: number }[] = [];
    legs.push({ distance: 0, duration: 0 }); // 最初のタスクは距離0

    for (let i = 1; i < optimized.length; i++) {
      if (directions && directions.legs[i - 1]) {
        legs.push(directions.legs[i - 1]);
      } else {
        legs.push(computeHaversineLeg(
          optimized[i - 1].lat, optimized[i - 1].lng,
          optimized[i].lat, optimized[i].lng,
        ));
      }
    }

    // estimatedArrival を計算
    // 起点時刻: 最初のタスクの timeSlotStart、なければ現在時刻(JST)
    let baseSeconds: number;
    if (optimized[0].timeSlotStart) {
      baseSeconds = timeToSeconds(optimized[0].timeSlotStart);
    } else {
      const now = new Date();
      const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
      baseSeconds = jst.getHours() * 3600 + jst.getMinutes() * 60;
    }

    let cumulativeSeconds = baseSeconds;
    const optimizedTasks: OptimizedTask[] = optimized.map((item, i) => {
      if (i > 0) {
        cumulativeSeconds += legs[i].duration;
      }

      return {
        task: item.task,
        sequenceNumber: i + 1,
        legDistance: legs[i].distance,
        legDuration: legs[i].duration,
        estimatedArrival: i === 0 ? null : secondsToTime(cumulativeSeconds),
        isTimeConstrained: item.timeSlotStart !== null,
      };
    });

    const totalDistance = legs.reduce((sum, l) => sum + l.distance, 0);
    const totalDuration = legs.reduce((sum, l) => sum + l.duration, 0);

    return NextResponse.json({
      optimizedTasks,
      totalDistance,
      totalDuration,
      polylineEncoded: directions?.polyline ?? null,
      skippedTasks,
    });
  } catch (error) {
    console.error('Route optimization error:', error);
    return NextResponse.json({ error: 'Failed to optimize route' }, { status: 500 });
  }
}
