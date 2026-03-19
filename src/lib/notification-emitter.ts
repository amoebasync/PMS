/**
 * インメモリ通知イベントエミッター
 *
 * 同一プロセス内で通知が作成された時に、接続中のSSEクライアントに即座にプッシュする。
 * 2台のEC2構成のため、別インスタンスで作成された通知はSSEのDB定期チェックで検出する。
 */

type NotificationListener = (data: { type: string; recipientId?: number | null }) => void;

class NotificationEmitter {
  private listeners = new Set<NotificationListener>();

  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  emit(data: { type: string; recipientId?: number | null }): void {
    for (const listener of this.listeners) {
      try { listener(data); } catch (e) { console.error('[NotifEmitter] listener error:', e); }
    }
  }
}

export const notificationEmitter = new NotificationEmitter();
