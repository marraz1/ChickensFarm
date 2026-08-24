import { z } from "zod";
import {
  DEFAULT_SEND_TIME,
  DEFAULT_TIME_ZONE,
  SEND_TIME_PATTERN,
} from "@/lib/notification-schedule";

export const DEFAULT_REMINDER_MESSAGE = "Nepamirškite suvesti šiandienos duomenų.";

// A client can send anything, so an unknown IANA name is rejected here rather
// than being discovered later inside the reminder batch.
const timeZoneField = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Nežinoma laiko juosta");

export const notificationSettingSchema = z
  .object({
    enabled: z.boolean(),
    message: z
      .string()
      .trim()
      .min(1, "Įveskite priminimo tekstą")
      .max(300, "Tekstas per ilgas (iki 300 simbolių)"),
    sendTime: z.string().regex(SEND_TIME_PATTERN, "Neteisingas laikas"),
    timeZone: timeZoneField,
    // The full union is kept so the type lines up with the Prisma enum that the
    // profile page reads back.
    channel: z.enum(["EMAIL", "PUSH"]),
  })
  // PUSH exists in the database enum so phase 2 needs no migration, but nothing
  // can deliver it yet — reject it here rather than storing an unsendable
  // channel. Done at the object level so `channel` keeps its union type.
  .superRefine((value, ctx) => {
    if (value.channel !== "EMAIL") {
      ctx.addIssue({
        code: "custom",
        path: ["channel"],
        message: "Pranešimai telefone dar neveikia",
      });
    }
  });

export type NotificationSettingInput = z.infer<typeof notificationSettingSchema>;

export const notificationSettingDefaults: NotificationSettingInput = {
  enabled: false,
  message: DEFAULT_REMINDER_MESSAGE,
  sendTime: DEFAULT_SEND_TIME,
  timeZone: DEFAULT_TIME_ZONE,
  channel: "EMAIL",
};
