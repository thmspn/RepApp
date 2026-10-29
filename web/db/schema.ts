import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    authorKey: text("author_key").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    category: text("category").notNull(),
    course: text("course").notNull().default(""),
    visibility: text("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("public"),
    kind: text("kind", { enum: ["concern", "update"] })
      .notNull()
      .default("concern"),
    status: text("status", { enum: ["open", "in-progress", "resolved"] })
      .notNull()
      .default("open"),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("conversations_author_idx").on(table.authorKey),
    index("conversations_feed_idx").on(table.visibility, table.createdAt),
    index("conversations_category_idx").on(table.category),
  ],
);

export const replies = sqliteTable(
  "replies",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    authorKey: text("author_key").notNull(),
    body: text("body").notNull(),
    isRep: integer("is_rep", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("replies_conversation_idx").on(table.conversationId, table.createdAt),
  ],
);

export const votes = sqliteTable(
  "votes",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    authorKey: text("author_key").notNull(),
  },
  (table) => [primaryKey({ columns: [table.conversationId, table.authorKey] })],
);

export const reports = sqliteTable(
  "reports",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    authorKey: text("author_key").notNull(),
    reason: text("reason").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.conversationId, table.authorKey] })],
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: integer("reset_at").notNull(),
});
