import { z } from "zod";
import { NOTIFICATION_PRIORITIES } from "./notification-schedule";

const dateTime = z.iso.datetime({ offset: true, error: "Geçerli bir tarih ve saat giriniz." }).transform((value) => new Date(value));

export const notificationInputSchema = z.object({
  title: z.string().trim().min(1, "Bildirim başlığı zorunludur.").max(150),
  description: z.string().trim().max(4000).nullable().optional().transform((value) => value || null),
  reminderType: z.string().trim().max(100).nullable().optional().transform((value) => value || null),
  priority: z.enum(NOTIFICATION_PRIORITIES).default("MEDIUM"),
  eventAt: dateTime,
}).strict().superRefine((value, context) => {
  if (value.eventAt.getTime() <= Date.now()) context.addIssue({ code: "custom", path: ["eventAt"], message: "Takip tarihi gelecekte olmalıdır." });
});

export type NotificationInput = z.infer<typeof notificationInputSchema>;
