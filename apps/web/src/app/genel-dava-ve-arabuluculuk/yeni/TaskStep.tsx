import { Dispatch, FormEvent, SetStateAction } from "react";
import CaseNotifications, { type CaseNotificationItem } from "@/components/case-notifications/CaseNotifications";
import { notificationLeadMinutes } from "@/lib/notification-schedule";

import styles from "./TaskStep.module.css";

export type TaskDraft = {
  clientId: string;
  title: string;
  description: string;
  assigneeUserId: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueAt: string;
  taskType: string;
  reminderOffsetMinutes: number | null;
  status: "PLANNED" | "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  creatorName: string;
};

type Props = {
  currentUser: { id: string; name: string };
  tasks: TaskDraft[];
  setTasks: Dispatch<SetStateAction<TaskDraft[]>>;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string;
};

export default function TaskStep({ currentUser, tasks, setTasks, onBack, onSubmit, error }: Props) {
  const notifications: CaseNotificationItem[] = tasks.map((task) => {
    const eventAt = new Date(task.dueAt).toISOString();
    const notifyAt = new Date(new Date(eventAt).getTime() - (task.reminderOffsetMinutes ?? notificationLeadMinutes(task.priority)) * 60_000).toISOString();
    return { id: task.clientId, title: task.title, description: task.description || null, reminderType: task.taskType || null, priority: task.priority, eventAt, notifyAt, status: task.status, creator: { name: task.creatorName || currentUser.name } };
  });
  function change(next: CaseNotificationItem[]) {
    setTasks(next.map((item) => ({ clientId: item.id, title: item.title, description: item.description ?? "", assigneeUserId: currentUser.id, priority: item.priority, dueAt: item.eventAt, taskType: item.reminderType ?? "", reminderOffsetMinutes: notificationLeadMinutes(item.priority), status: taskStatus(item.status), creatorName: item.creator.name })));
  }
  return <div className={styles.form}>
    {error && <p className={styles.error}>{error}</p>}
    <CaseNotifications initialItems={notifications} onItemsChange={change} currentUserName={currentUser.name} />
    <form onSubmit={onSubmit}><footer><button type="button" className={styles.back} onClick={onBack}>← Evraklar</button><span>6 / 7 · Bildirimler</span><button type="submit">Notlara İlerle →</button></footer></form>
  </div>;
}
function taskStatus(value: string): TaskDraft["status"] { return value === "SENT" || value === "COMPLETED" ? "COMPLETED" : value === "WAITING" || value === "IN_PROGRESS" || value === "CANCELLED" ? value : "PLANNED"; }
