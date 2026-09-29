import { describe, expect, it } from "vitest";
import { FEEDBACK_MAX_LENGTH, feedbackSchema } from "./feedback";

describe("feedbackSchema", () => {
  it("accepts and trims a message", () => {
    expect(feedbackSchema.parse({ message: "  Labai patogu!  " })).toEqual({
      message: "Labai patogu!",
    });
  });

  it("rejects an empty or whitespace-only message", () => {
    expect(feedbackSchema.safeParse({ message: "" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ message: "   \n " }).success).toBe(false);
    expect(feedbackSchema.safeParse({}).success).toBe(false);
  });

  it("enforces the length limit, which matches the VarChar column", () => {
    expect(feedbackSchema.safeParse({ message: "a".repeat(FEEDBACK_MAX_LENGTH) }).success).toBe(
      true,
    );
    expect(feedbackSchema.safeParse({ message: "a".repeat(FEEDBACK_MAX_LENGTH + 1) }).success).toBe(
      false,
    );
  });

  it("strips client-supplied tenant fields", () => {
    const parsed = feedbackSchema.parse({
      message: "Sveiki",
      farmId: "someone-elses-farm",
      userId: "someone-else",
    });
    expect(parsed).toEqual({ message: "Sveiki" });
  });
});
