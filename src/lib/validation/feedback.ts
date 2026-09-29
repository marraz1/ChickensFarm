import { z } from "zod";

export const FEEDBACK_MAX_LENGTH = 2000;

// Deliberately only the message: who sent it and for which farm are resolved on
// the server (see createFeedback), so there is nothing else a client may set.
export const feedbackSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Parašykite atsiliepimą")
    .max(FEEDBACK_MAX_LENGTH, `Tekstas per ilgas (iki ${FEEDBACK_MAX_LENGTH} simbolių)`),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
