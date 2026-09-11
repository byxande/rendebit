import { Bell, Check, CircleCheckBig, ShieldCheck, X } from "lucide-react";

export type AppNotificationView = {
  id: number;
  kind: "confirmation_required" | "info" | "success" | "warning";
  title: string;
  body: string;
  actionLabel: string | null;
  actionView: string | null;
  relatedXverseActionId: number | null;
  readAt: Date | string | null;
  createdAt: Date | string;
};

type NotificationCenterProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: AppNotificationView[];
  unreadCount: number;
  onMarkRead: (notificationId: number) => void;
  onMarkAllRead: () => void;
  onAction: (notification: AppNotificationView) => void;
};

function notificationIcon(kind: AppNotificationView["kind"]) {
  if (kind === "confirmation_required") return <ShieldCheck size={16} />;
  if (kind === "success") return <CircleCheckBig size={16} />;
  return <Bell size={16} />;
}

function relativeDate(value: Date | string) {
  const timestamp = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Agora mesmo";
  if (seconds < 3_600) return `Há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86_400) return `Há ${Math.floor(seconds / 3_600)} h`;
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export default function NotificationCenter({
  open,
  onOpenChange,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onAction,
}: NotificationCenterProps) {
  return (
    <div className="br-notification-center">
      <button
        aria-label={
          unreadCount ? `${unreadCount} avisos novos` : "Abrir avisos"
        }
        aria-expanded={open}
        className={`br-notification-trigger ${unreadCount ? "has-unread" : ""}`}
        onClick={() => onOpenChange(!open)}
        type="button"
      >
        <Bell size={16} />
        {unreadCount > 0 && <span>{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && (
        <section
          aria-label="Avisos da sua conta"
          className="br-notification-popover"
        >
          <header>
            <div>
              <span>SEUS AVISOS</span>
              <b>
                {unreadCount ? `${unreadCount} para você ver` : "Tudo em dia"}
              </b>
            </div>
            <button
              aria-label="Fechar avisos"
              className="br-notification-close"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              <X size={15} />
            </button>
          </header>
          {unreadCount > 0 && (
            <button
              className="br-notification-read-all"
              onClick={onMarkAllRead}
              type="button"
            >
              <Check size={13} /> Marcar tudo como visto
            </button>
          )}
          <div className="br-notification-list">
            {notifications.length === 0 ? (
              <div className="br-notification-empty">
                <div>
                  <CircleCheckBig size={20} />
                </div>
                <b>Por enquanto, tudo certo.</b>
                <p>
                  Quando você precisar conferir alguma coisa, o aviso aparece
                  aqui.
                </p>
              </div>
            ) : (
              notifications.map(notification => (
                <article
                  className={`br-notification-item ${notification.readAt ? "is-read" : "is-unread"}`}
                  key={notification.id}
                >
                  <div className={`br-notification-icon ${notification.kind}`}>
                    {notificationIcon(notification.kind)}
                  </div>
                  <div className="br-notification-copy">
                    <div>
                      <b>{notification.title}</b>
                      <time>{relativeDate(notification.createdAt)}</time>
                    </div>
                    <p>{notification.body}</p>
                    <div className="br-notification-actions">
                      {notification.actionLabel && (
                        <button
                          onClick={() => onAction(notification)}
                          type="button"
                        >
                          {notification.actionLabel}
                        </button>
                      )}
                      {!notification.readAt && (
                        <button
                          className="br-notification-dismiss"
                          onClick={() => onMarkRead(notification.id)}
                          type="button"
                        >
                          Marcar como visto
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
