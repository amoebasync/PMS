'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/i18n';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  scheduleId: number | null;
  distributorName: string | null;
  alertDefinitionId: number | null;
  alertId: number | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const { t } = useTranslation('common');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const lastNotifIdRef = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        setPermissionGranted(perm === 'granted');
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      setPermissionGranted(true);
    }
  }, []);

  // Show OS notification
  const showBrowserNotification = useCallback((title: string, body: string) => {
    if (!permissionGranted) return;
    try {
      new Notification(title, {
        body,
        icon: '/logo/logo_Icon_transparent.png',
        tag: 'pms-distribution',
      });
    } catch {
      // Notification API not available
    }
  }, [permissionGranted]);

  // Fetch notifications via regular API (initial load + fallback)
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=20');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);

      // Update lastNotifIdRef without triggering OS notifications on initial load
      if (data.notifications.length > 0) {
        lastNotifIdRef.current = data.notifications[0].id;
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Connect to SSE stream
  const connectSSE = useCallback(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const es = new EventSource('/api/admin/notifications/stream');
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      // Connection established
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });

    es.addEventListener('notification', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.notifications && Array.isArray(data.notifications)) {
          const newNotifs: Notification[] = data.notifications.map((n: Record<string, unknown>) => ({
            id: n.id as number,
            type: n.type as string,
            title: n.title as string,
            message: (n.message as string) || null,
            scheduleId: (n.scheduleId as number) || null,
            distributorName: (n.distributor as Record<string, unknown>)?.name as string || null,
            alertDefinitionId: (n.alertDefinitionId as number) || null,
            alertId: (n.alertId as number) || null,
            isRead: (n.isRead as boolean) || false,
            createdAt: n.createdAt as string,
          }));

          // Show OS notification for each new item
          for (const n of newNotifs) {
            if (n.id > lastNotifIdRef.current) {
              showBrowserNotification(
                n.type === 'ALERT' ? 'PMS アラート' : 'PMS 配布通知',
                n.title
              );
            }
          }

          // Update lastNotifIdRef
          if (newNotifs.length > 0) {
            const maxId = Math.max(...newNotifs.map(n => n.id));
            if (maxId > lastNotifIdRef.current) {
              lastNotifIdRef.current = maxId;
            }
          }

          // Prepend new notifications to existing list, deduplicate by id
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const uniqueNew = newNotifs.filter(n => !existingIds.has(n.id));
            const merged = [...uniqueNew, ...prev].slice(0, 20);
            return merged;
          });

          // Update unread count
          setUnreadCount(prev => {
            const newUnread = newNotifs.filter(n => !n.isRead).length;
            return prev + newUnread;
          });
        }
      } catch {
        // Parse error, ignore
      }
    });

    es.onerror = () => {
      // EventSource will auto-reconnect, but if it closes permanently, reconnect manually
      if (es.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null;
        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSSE();
        }, 5000);
      }
    };
  }, [showBrowserNotification]);

  // Initial load + SSE connection
  useEffect(() => {
    // Fetch initial notifications via regular API
    fetchNotifications();

    // Then connect to SSE for real-time updates
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [fetchNotifications, connectSSE]);

  // Mark all as read
  const markAllRead = async () => {
    try {
      await fetch('/api/admin/notifications/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  // Mark single as read
  const markRead = async (id: number) => {
    try {
      await fetch('/api/admin/notifications/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const fmtTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);

      if (diffMin < 1) return t('notification_just_now');
      if (diffMin < 60) return t('notification_minutes_ago', { count: diffMin });
      if (diffMin < 1440) return t('notification_hours_ago', { count: Math.floor(diffMin / 60) });
      return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo' });
    } catch {
      return '';
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('notifications')}
        className="relative min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
      >
        <i className="bi bi-bell text-lg"></i>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-700">{t('notifications')}</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-bold"
              >
                {t('mark_all_read')}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                {t('no_notifications')}
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.isRead) markRead(n.id);
                    if (n.type === 'ALERT') {
                      window.location.href = '/alerts';
                    } else if (n.scheduleId) {
                      window.location.href = `/schedules?trajectory=${n.scheduleId}`;
                    }
                  }}
                  className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${
                    !n.isRead ? 'bg-indigo-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 shrink-0 ${
                      n.type === 'ALERT'
                        ? 'text-orange-500'
                        : n.type === 'DISTRIBUTION_START'
                          ? 'text-emerald-500'
                          : 'text-blue-500'
                    }`}>
                      <i className={`bi ${
                        n.type === 'ALERT'
                          ? 'bi-exclamation-triangle-fill'
                          : n.type === 'DISTRIBUTION_START'
                            ? 'bi-play-circle-fill'
                            : 'bi-check-circle-fill'
                      }`}></i>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${!n.isRead ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{n.message}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{fmtTime(n.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
