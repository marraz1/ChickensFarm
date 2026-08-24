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
    // Optional: empty means the reminder goes to the account email.
    email: z
      .string()
      .trim()
      .email("Neteisingas el. pašto formatas")
      .max(254)
      .optional()
      .or(z.literal("")),
    timeZone: timeZoneField,
    // Independent rather than one enum: both channels can be on at once.
    emailEnabled: z.boolean(),
    pushEnabled: z.boolean(),
  })
  // Reminders on with nowhere to send them is a silent no-op, and the user would
  // have no way to tell it from a broken schedule.
  .superRefine((value, ctx) => {
    if (value.enabled && !value.emailEnabled && !value.pushEnabled) {
      ctx.addIssue({
        code: "custom",
        path: ["emailEnabled"],
        message: "Pasirinkite bent vieną pranešimo būdą",
      });
    }
  });

export type NotificationSettingInput = z.infer<typeof notificationSettingSchema>;

export const notificationSettingDefaults: NotificationSettingInput = {
  enabled: false,
  message: DEFAULT_REMINDER_MESSAGE,
  sendTime: DEFAULT_SEND_TIME,
  email: "",
  timeZone: DEFAULT_TIME_ZONE,
  emailEnabled: true,
  pushEnabled: false,
};
