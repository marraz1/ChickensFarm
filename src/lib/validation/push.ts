import { z } from "zod";

// Mirrors the browser's PushSubscription.toJSON() shape.
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().trim().url("Neteisingas endpoint").max(2000),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(255),
    auth: z.string().trim().min(1).max(255),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().trim().url("Neteisingas endpoint").max(2000),
});
