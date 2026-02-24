'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Shift = {
  id: number;
  date: string;
  status: string;
};

type PayrollRecord = {
  grossPay: number;
  status: 'DRAFT' | 'CONFIRMED' | 'PAID';
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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const statusColor: Record<string, string> = {
  WORKING:   'bg-emerald-500 text-white',
  APPROVED:  'bg-emerald-500 text-white',
  REQUESTED: 'bg-indigo-400 text-white',
  REJECTED:  'bg-rose-400 text-white',
  CANCELED:  'bg-slate-300 text-slate-600',
};
const statusLabel: Record<string, string> = {
  WORKING:   'Registered',
  APPROVED:  'Registered',
  REQUESTED: 'Pending',
  REJECTED:  'Rejected',
  CANCELED:  'Canceled',
};

export default function DistributorDashboardEn() {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord>(null);
  const [loading, setLoading] = useState(true);

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

      if (profile.language !== 'en') {
        router.push('/staff');
        return;
      }

      if (profile.isPasswordTemp) {
        router.push('/staff/en/change-password');
        return;
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

      // Fetch this week's payroll
      const payrollRes = await fetch(`/api/staff/payroll?year=${today.getFullYear()}&month=${today.getMonth() + 1}`);
      if (payrollRes.ok) {
        const payrollData = await payrollRes.json();
        setPayroll(payrollData.upcomingRecord || null);
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

  const fridayLabel = friday.toLocaleString('en-US', { month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      {/* 7-day shift schedule */}
      <div>
        <h2 className="text-sm font-bold text-slate-600 mb-3 px-1">Upcoming 7-Day Schedule</h2>
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
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ${statusColor[shift.status] || 'bg-slate-200 text-slate-600'}`}>
                      {statusLabel[shift.status] || shift.status}
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-200">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Friday payment */}
      <Link href="/staff/en/payroll" className="block bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-bold text-slate-500 mb-1">
            Payment on {fridayLabel} (Fri)
          </p>
          {payroll && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              payroll.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
              payroll.status === 'CONFIRMED' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-500'
            }`}>
              {payroll.status === 'PAID' ? 'Paid' : payroll.status === 'CONFIRMED' ? 'Confirmed' : 'Processing'}
            </span>
          )}
        </div>
        {payroll ? (
          <>
            <p className="text-3xl font-black text-indigo-600">¥{payroll.grossPay.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">Tap to view breakdown</p>
          </>
        ) : (
          <>
            <p className="text-3xl font-black text-slate-300">¥ ——</p>
            <p className="text-xs text-slate-400 mt-1">Will be updated after calculation</p>
          </>
        )}
      </Link>

      {/* Quick links */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-600 px-1">Quick Access</h2>
        <Link
          href="/staff/en/shifts"
          className="flex items-center gap-4 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 hover:bg-indigo-50 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <i className="bi bi-calendar3 text-2xl text-indigo-600"></i>
          </div>
          <div>
            <p className="font-bold text-slate-800">Shift Registration</p>
            <p className="text-xs text-slate-500 mt-0.5">Register or cancel shifts from the weekly calendar</p>
          </div>
          <i className="bi bi-chevron-right text-slate-300 ml-auto text-lg"></i>
        </Link>

        <Link
          href="/staff/en/expenses"
          className="flex items-center gap-4 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 hover:bg-emerald-50 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <i className="bi bi-train-front-fill text-2xl text-emerald-600"></i>
          </div>
          <div>
            <p className="font-bold text-slate-800">Transportation Expense</p>
            <p className="text-xs text-slate-500 mt-0.5">Submit expenses and view history</p>
          </div>
          <i className="bi bi-chevron-right text-slate-300 ml-auto text-lg"></i>
        </Link>

        <Link
          href="/staff/en/profile"
          className="flex items-center gap-4 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <i className="bi bi-person-fill text-2xl text-slate-600"></i>
          </div>
          <div>
            <p className="font-bold text-slate-800">Profile</p>
            <p className="text-xs text-slate-500 mt-0.5">Edit contact info and photo</p>
          </div>
          <i className="bi bi-chevron-right text-slate-300 ml-auto text-lg"></i>
        </Link>
      </div>
    </div>
  );
}
