import { z } from "zod";
export const conversationInput = z
  .object({
    title: z
      .string()
      .trim()
      .min(8, "Give your conversation a title of at least 8 characters.")
      .max(160, "Keep the title under 160 characters."),
    body: z
      .string()
      .trim()
      .min(20, "Add a little more detail (at least 20 characters).")
      .max(5000, "Keep your message under 5,000 characters."),
    category: z.enum(["academics", "workload", "campus", "coop", "other"]),
    course: z
      .string()
      .trim()
      .max(24)
      .regex(/^[a-zA-Z0-9 \-]*$/, "Use a course code, like MATH 115.")
      .transform((value) => value.toUpperCase())
      .default(""),
    visibility: z.enum(["public", "private"]).default("public"),
    kind: z.enum(["concern", "update"]).default("concern"),
  })
  .strict();
export const replyInput = z
  .object({
    body: z
      .string()
      .trim()
      .min(2, "Write a reply first.")
      .max(4000, "Keep replies under 4,000 characters."),
    asRep: z.boolean().default(false),
  })
  .strict();
export const updateInput = z
  .object({
    status: z.enum(["open", "in-progress", "resolved"]).optional(),
    pinned: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => value.status !== undefined || value.pinned !== undefined,
    "Choose an update to make.",
  );
export const reportInput = z
  .object({
    reason: z
      .string()
      .trim()
      .min(5, "Briefly explain what the reps should review.")
      .max(500, "Keep reports under 500 characters."),
  })
  .strict();
export const voteInput = z.object({ voted: z.boolean() }).strict();
