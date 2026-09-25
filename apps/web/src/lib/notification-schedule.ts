export const NOTIFICATION_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export type NotificationPriority = typeof NOTIFICATION_PRIORITIES[number];

const LEAD_MINUTES: Record<NotificationPriority, number> = {
  HIGH: 3 * 24 * 60,
  MEDIUM: 2 * 24 * 60,
  LOW: 3 * 60,
};

export function notificationLeadMinutes(priority: NotificationPriority) {
  return LEAD_MINUTES[priority];
}

export function notificationTime(eventAt: Date, priority: NotificationPriority) {
  return new Date(eventAt.getTime() - notificationLeadMinutes(priority) * 60_000);
}

export function notificationPriorityLabel(priority: NotificationPriority) {
  return priority === "HIGH" ? "Çok Önemli" : priority === "MEDIUM" ? "Önemli" : "Az Önemli";
}

export function notificationLeadLabel(priority: NotificationPriority) {
  return priority === "HIGH" ? "3 gün önce" : priority === "MEDIUM" ? "2 gün önce" : "3 saat önce";
}
