'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OnboardingModal from '@/components/staff/OnboardingModal';
import SetupPromptModal from '@/components/staff/SetupPromptModal';

type Shift = {
  id: number;
  date: string;
  status: string;
};

type PayrollRecord = {
  grossPay: number;
  status: 'DRAFT' | 'CONFIRMED' | 'PAID' | 'ESTIMATED';
  paymentDate: string;
} | null;

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getUpcomingFriday(from: Date): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const daysUntil = (5 - day + 7) % 7; // 0 if today is Friday
  d.setDate(d.getDate() + daysUntil);
  return d;
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

const statusColor: Record<string, string> = {
  WORKING:   'bg-emerald-500 text-white',
  APPROVED:  'bg-emerald-500 text-white',
  REQUESTED: 'bg-indigo-400 text-white',
  REJECTED:  'bg-rose-400 text-white',
  CANCELED:  'bg-slate-300 text-slate-600',
};
const statusLabel: Record<string, string> = {
  WORKING:   '登録済',
  APPROVED:  '登録済',
  REQUESTED: '確認中',
  REJECTED:  '却下',
  CANCELED:  '取消',
};

export default function DistributorDashboard() {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [missingSteps, setMissingSteps] = useState<('residence-card' | 'payment-method')[]>([]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  const friday = getUpcomingFriday(today);

  useEffect(() => {
    const load = async () => {
      const profileRes = await fetch('/api/staff/profile');
      if (!profileRes.ok) {
        router.push('/staff/login');
        return;
      }

      const profile = await profileRes.json();

      if (profile.language === 'en') {
        router.push('/staff/en');
        return;
      }

      if (profile.isPasswordTemp) {
        router.push('/staff/change-password');
        return;
      }

      // Determine missing setup steps
      const missing: ('residence-card' | 'payment-method')[] = [];
      if (!profile.residenceCardFrontUrl || !profile.residenceCardBackUrl) {
        missing.push('residence-card');
      }
      if (!profile.paymentMethod) {
        missing.push('payment-method');
      }
      setMissingSteps(missing);

      if (!profile.hasSeenOnboarding) {
        setShowOnboarding(true);
      } else if (missing.length > 0) {
        // If onboarding already done but setup incomplete, show setup prompt directly
        setShowSetup(true);
      }

      // Fetch shifts — may span two months
      const endDay = new Date(today);
      endDay.setDate(endDay.getDate() + 6);

      const fetchMonths: Array<{ year: number; month: number }> = [
        { year: today.getFullYear(), month: today.getMonth() + 1 },
      ];
      if (endDay.getMonth() !== today.getMonth()) {
        fetchMonths.push({ year: endDay.getFullYear(), month: endDay.getMonth() + 1 });
      }

      const responses = await Promise.all(
        fetchMonths.map(({ year, month }) =>
          fetch(`/api/staff/shifts?year=${year}&month=${month}`)
        )
      );

      let allShifts: Shift[] = [];
      for (const res of responses) {
        if (res.ok) {
          const data = await res.json();
          allShifts = allShifts.concat(data.shifts || []);
        }
      }

      setShifts(allShifts);

      // 今週の給与レコード取得
      const payrollRes = await fetch(`/api/staff/payroll?year=${today.getFullYear()}&month=${today.getMonth() + 1}`);
      if (payrollRes.ok) {
        const payrollData = await payrollRes.json();
        if (payrollData.upcomingRecord) {
          setPayroll(payrollData.upcomingRecord);
        } else {
          try {
            // 次の金曜の支払い対象 = 前週の日曜〜土曜
            const friday = getUpcomingFriday(today);
            const targetSunday = new Date(friday);
            targetSunday.setDate(friday.getDate() - 5 - 7); // 前週の日曜
            const earningsRes = await fetch(`/api/staff/distribution/earnings?mode=weekly&date=${formatDate(targetSunday)}`);
            if (earningsRes.ok) {
              const earningsData = await earningsRes.json();
              if (earningsData.totalEarnings > 0) {
                setPayroll({
                  grossPay: earningsData.totalEarnings,
                  status: 'ESTIMATED',
                  paymentDate: formatDate(friday),
                });
              }
            }
          } catch { /* ignore */ }
        }
      }

      setLoading(false);
    };

    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const shiftMap = new Map(shifts.map((s) => [s.date.slice(0, 10), s]));

  return (
    <div className="space-y-6">
      {showOnboarding && (
        <OnboardingModal lang="ja" onComplete={() => {
          setShowOnboarding(false);
          if (missingSteps.length > 0) setShowSetup(true);
        }} />
      )}
      {showSetup && !showOnboarding && (
        <SetupPromptModal lang="ja" missingSteps={missingSteps} onComplete={() => setShowSetup(false)} />
      )}

      {/* 7-day shift schedule */}
      <div>
        <h2 className="text-sm font-bold text-slate-600 mb-3 px-1">今後7日間のシフト</h2>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100">
            {weekDays.map((day, i) => {
              const dayOfWeek = day.getDay();
              const isSat = dayOfWeek === 6;
              const isSun = dayOfWeek === 0;
              return (
                <div key={i} className={`py-2 text-center text-xs font-bold ${isSat ? 'text-sky-500' : isSun ? 'text-rose-500' : 'text-slate-500'}`}>
                  {DAY_NAMES[dayOfWeek]}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7">
            {weekDays.map((day, i) => {
              const dateStr = formatDate(day);
              const shift = shiftMap.get(dateStr);
              const isToday = i === 0;
              const dayOfWeek = day.getDay();
              const isSat = dayOfWeek === 6;
              const isSun = dayOfWeek === 0;
              return (
                <div key={dateStr} className={`flex flex-col items-center justify-center p-2 min-h-[76px] border-r last:border-r-0 border-slate-50 ${isToday ? 'bg-blue-50' : ''}`}>
                  <span className={`text-sm font-bold mb-1 ${
                    isToday
                      ? 'w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs'
                      : isSat ? 'text-sky-500' : isSun ? 'text-rose-500' : 'text-slate-700'
                  }`}>
                    {day.getDate()}
                  </span>
                  {shift ? (
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${statusColor[shift.status]?.split(' ')[0] || 'bg-slate-200'}`} title={statusLabel[shift.status] || shift.status}></span>
                  ) : (
                    <span className="text-[9px] text-slate-300">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Friday payment */}
      <Link href="/staff/payroll" className="block bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-bold text-slate-500 mb-1">
            {friday.getMonth() + 1}月{friday.getDate()}日（金）の支払予定額
          </p>
          {payroll && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              payroll.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
              payroll.status === 'CONFIRMED' ? 'bg-amber-100 text-amber-700' :
              payroll.status === 'ESTIMATED' ? 'bg-blue-100 text-blue-600' :
              'bg-slate-100 text-slate-500'
            }`}>
              {payroll.status === 'PAID' ? '支払済' : payroll.status === 'CONFIRMED' ? '確定済' : payroll.status === 'ESTIMATED' ? '予想' : '計算中'}
            </span>
          )}
        </div>
        {payroll ? (
          <>
            <p className={`text-3xl font-black ${payroll.status === 'ESTIMATED' ? 'text-blue-500' : 'text-indigo-600'}`}>¥{payroll.grossPay.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">{payroll.status === 'ESTIMATED' ? '完了したスケジュールから計算' : 'タップして明細を確認'}</p>
          </>
        ) : (
          <>
            <p className="text-3xl font-black text-slate-300">¥ ——</p>
            <p className="text-xs text-slate-400 mt-1">管理者が計算後に反映されます</p>
          </>
        )}
      </Link>

      {/* Quick links */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-600 px-1">クイックアクセス</h2>
        <Link
          href="/staff/shifts"
          className="flex items-center gap-4 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 hover:bg-indigo-50 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <i className="bi bi-calendar3 text-2xl text-indigo-600"></i>
          </div>
          <div>
            <p className="font-bold text-slate-800">シフト申請</p>
            <p className="text-xs text-slate-500 mt-0.5">週次カレンダーから申請・取消</p>
          </div>
          <i className="bi bi-chevron-right text-slate-300 ml-auto text-lg"></i>
        </Link>

        <Link
          href="/staff/expenses"
          className="flex items-center gap-4 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 hover:bg-emerald-50 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <i className="bi bi-train-front-fill text-2xl text-emerald-600"></i>
          </div>
          <div>
            <p className="font-bold text-slate-800">交通費申請</p>
            <p className="text-xs text-slate-500 mt-0.5">交通費の申請・履歴確認</p>
          </div>
          <i className="bi bi-chevron-right text-slate-300 ml-auto text-lg"></i>
        </Link>

        <Link
          href="/staff/profile"
          className="flex items-center gap-4 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <i className="bi bi-person-fill text-2xl text-slate-600"></i>
          </div>
          <div>
            <p className="font-bold text-slate-800">プロフィール</p>
            <p className="text-xs text-slate-500 mt-0.5">連絡先・写真の編集</p>
          </div>
          <i className="bi bi-chevron-right text-slate-300 ml-auto text-lg"></i>
        </Link>
      </div>
    </div>
  );
}
