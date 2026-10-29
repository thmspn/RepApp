import { env } from "cloudflare:workers";
import { and, asc, desc, eq, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import {
  conversations,
  rateLimits,
  replies,
  reports,
  votes,
} from "@/db/schema";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { TOKEN_PATTERN } from "./domain";
import {
  conversationInput,
  replyInput,
  reportInput,
  updateInput,
  voteInput,
} from "./validation";

type Actor = { key: string; isRep: boolean; repConfigured: boolean };
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const repEmails = () =>
  (env.REP_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

async function hash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
async function actorFor(request: Request): Promise<Actor> {
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!TOKEN_PATTERN.test(token))
    throw new ApiError(
      401,
      "Your anonymous key is missing. Reload the page to reconnect.",
    );
  const user = await getChatGPTUser();
  const allowed = repEmails();
  // The starter's loopback-only auth simulator is removed from production builds.
  const localRep = import.meta.env.DEV && user?.userId === "local_seedy";
  return {
    key: await hash(token),
    isRep: Boolean(
      localRep || (user && allowed.includes(user.email.toLowerCase())),
    ),
    repConfigured: allowed.length > 0 || import.meta.env.DEV,
  };
}
function requireRep(actor: Actor) {
  if (!actor.isRep)
    throw new ApiError(403, "Only an authorized academic rep can do that.");
}
function checkOrigin(request: Request) {
  if (request.method === "GET") return;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new ApiError(403, "Please send this request from RepApp.");
}
async function readInput<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "Please send a JSON message.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Your message was empty.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 24000) {
      await reader.cancel();
      throw new ApiError(413, "That message is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(
      400,
      "That message could not be read. Please try again.",
    );
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ?? "Check your message and try again.",
    );
  return parsed.data;
}
async function rateLimit(
  actor: Actor,
  action: string,
  limit: number,
  windowMs = 600000,
) {
  const now = Date.now();
  const result = await getDb()
    .insert(rateLimits)
    .values({
      key: `${actor.key}:${action}`,
      count: 1,
      resetAt: now + windowMs,
    })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.resetAt} <= ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= ${now} THEN ${now + windowMs} ELSE ${rateLimits.resetAt} END`,
      },
    })
    .returning({ count: rateLimits.count });
  if (result[0].count > limit)
    throw new ApiError(
      429,
      "You’ve sent quite a few messages. Give it a few minutes, then try again.",
    );
}
function visibility(actor: Actor): SQL | undefined {
  return actor.isRep
    ? undefined
    : or(
        eq(conversations.visibility, "public"),
        eq(conversations.authorKey, actor.key),
      );
}
// Keep the outer table explicit: Drizzle removes interpolated column qualifiers
// in single-table selections, and an inner replies.id would shadow the outer id.
const replyCount = sql<number>`(SELECT count(*) FROM replies WHERE replies.conversation_id = conversations.id)`;
const repReplyCount = sql<number>`(SELECT count(*) FROM replies WHERE replies.conversation_id = conversations.id AND replies.is_rep = 1)`;
const voteCount = sql<number>`(SELECT count(*) FROM votes WHERE votes.conversation_id = conversations.id)`;
function projection(actor: Actor) {
  return {
    id: conversations.id,
    title: conversations.title,
    body: conversations.body,
    category: conversations.category,
    course: conversations.course,
    visibility: conversations.visibility,
    kind: conversations.kind,
    status: conversations.status,
    pinned: conversations.pinned,
    createdAt: conversations.createdAt,
    updatedAt: conversations.updatedAt,
    replyCount,
    repReplyCount,
    voteCount,
    voted:
      sql<boolean>`EXISTS(SELECT 1 FROM votes WHERE votes.conversation_id = conversations.id AND votes.author_key = ${actor.key})`.mapWith(
        Boolean,
      ),
    isMine: sql<boolean>`${conversations.authorKey} = ${actor.key}`.mapWith(
      Boolean,
    ),
    reportCount: actor.isRep
      ? sql<number>`(SELECT count(*) FROM reports WHERE reports.conversation_id = conversations.id)`
      : sql<number>`0`,
  };
}
async function findConversation(id: string, actor: Actor) {
  const [row] = await getDb()
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), visibility(actor)))
    .limit(1);
  if (!row)
    throw new ApiError(
      404,
      "This conversation isn’t available. It may be private or have been deleted.",
    );
  return row;
}
async function listConversations(url: URL, actor: Actor) {
  const query = url.searchParams;
  const conditions: (SQL | undefined)[] = [visibility(actor)];
  const view = query.get("view") ?? "all";
  if (view === "rep") requireRep(actor);
  if (view === "mine") conditions.push(eq(conversations.authorKey, actor.key));
  if (view === "updates") conditions.push(eq(conversations.kind, "update"));
  if (query.get("category"))
    conditions.push(eq(conversations.category, query.get("category")!));
  if (query.get("course"))
    conditions.push(
      eq(conversations.course, query.get("course")!.slice(0, 24)),
    );
  const status = query.get("status");
  if (["open", "in-progress", "resolved"].includes(status ?? ""))
    conditions.push(
      eq(conversations.status, status as "open" | "in-progress" | "resolved"),
    );
  if (status === "unanswered")
    conditions.push(
      eq(conversations.kind, "concern"),
      sql`${repReplyCount} = 0`,
    );
  const search = query.get("q")?.trim().slice(0, 160);
  if (search) {
    const escaped = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        sql`${conversations.title} LIKE ${escaped} ESCAPE '\\'`,
        sql`${conversations.body} LIKE ${escaped} ESCAPE '\\'`,
        sql`${conversations.course} LIKE ${escaped} ESCAPE '\\'`,
      ),
    );
  }
  const rawPage = Number(query.get("page") ?? 0);
  const page = Number.isFinite(rawPage)
    ? Math.min(10000, Math.max(0, Math.floor(rawPage)))
    : 0;
  const order =
    query.get("sort") === "popular"
      ? [
          desc(conversations.pinned),
          desc(voteCount),
          desc(conversations.createdAt),
          desc(conversations.id),
        ]
      : [
          desc(conversations.pinned),
          desc(conversations.createdAt),
          desc(conversations.id),
        ];
  const db = getDb();
  const rows = await db
    .select(projection(actor))
    .from(conversations)
    .where(and(...conditions))
    .orderBy(...order)
    .limit(20)
    .offset(page * 20);
  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(and(...conditions));
  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      open: sql<number>`coalesce(sum(CASE WHEN ${conversations.status} = 'open' AND ${conversations.kind} = 'concern' THEN 1 ELSE 0 END), 0)`,
      inProgress: sql<number>`coalesce(sum(CASE WHEN ${conversations.status} = 'in-progress' THEN 1 ELSE 0 END), 0)`,
      resolved: sql<number>`coalesce(sum(CASE WHEN ${conversations.status} = 'resolved' THEN 1 ELSE 0 END), 0)`,
      mine: sql<number>`coalesce(sum(CASE WHEN ${conversations.authorKey} = ${actor.key} THEN 1 ELSE 0 END), 0)`,
    })
    .from(conversations)
    .where(visibility(actor));
  const courses = await db
    .selectDistinct({ course: conversations.course })
    .from(conversations)
    .where(and(visibility(actor), sql`${conversations.course} != ''`))
    .orderBy(asc(conversations.course));
  return {
    conversations: rows,
    total: total.count,
    hasMore: (page + 1) * 20 < total.count,
    stats,
    courses: courses.map((row) => row.course),
  };
}
async function detail(id: string, actor: Actor) {
  const thread = await findConversation(id, actor);
  const [conversation] = await getDb()
    .select(projection(actor))
    .from(conversations)
    .where(eq(conversations.id, id));
  const rows = (
    await getDb()
      .select()
      .from(replies)
      .where(eq(replies.conversationId, id))
      .orderBy(desc(replies.createdAt), desc(replies.id))
      .limit(500)
  ).reverse();
  const animals = [
    "Otter",
    "Fox",
    "Owl",
    "Bee",
    "Turtle",
    "Robin",
    "Panda",
    "Koala",
    "Finch",
    "Frog",
    "Deer",
    "Badger",
    "Hare",
    "Dolphin",
    "Sparrow",
    "Penguin",
  ];
  const safeReplies = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      body: row.body,
      isRep: row.isRep,
      isMine: row.authorKey === actor.key,
      isOriginalPoster: row.authorKey === thread.authorKey,
      authorName: row.isRep
        ? "Academic rep"
        : row.authorKey === thread.authorKey
          ? "Original poster"
          : `Anonymous ${animals[parseInt((await hash(`${id}:${row.authorKey}`)).slice(0, 4), 16) % animals.length]}`,
      createdAt: row.createdAt,
    })),
  );
  return { conversation, replies: safeReplies };
}
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export async function handleApi(request: Request): Promise<Response> {
  try {
    checkOrigin(request);
    const actor = await actorFor(request);
    const url = new URL(request.url);
    const parts = url.pathname
      .replace(/^\/api\//, "")
      .split("/")
      .filter(Boolean);
    const method = request.method;
    if (parts[0] === "session" && parts.length === 1 && method === "GET")
      return json({ isRep: actor.isRep, repConfigured: actor.repConfigured });
    if (parts[0] !== "conversations")
      throw new ApiError(404, "That page wasn’t found.");
    if (parts.length === 1 && method === "GET")
      return json(await listConversations(url, actor));
    if (parts.length === 1 && method === "POST") {
      const input = await readInput(request, conversationInput);
      if (input.kind === "update") {
        requireRep(actor);
        if (input.visibility !== "public")
          throw new ApiError(
            400,
            "Class updates must be visible to the class.",
          );
      }
      await rateLimit(actor, "conversation", 5);
      const now = Date.now();
      const id = crypto.randomUUID();
      await getDb()
        .insert(conversations)
        .values({
          ...input,
          id,
          authorKey: actor.key,
          createdAt: now,
          updatedAt: now,
          status: input.kind === "update" ? "resolved" : "open",
          pinned: input.kind === "update",
        });
      return json(await detail(id, actor), 201);
    }
    const id = parts[1];
    if (!id || !/^[a-f0-9-]{36}$/.test(id))
      throw new ApiError(404, "That conversation wasn’t found.");
    if (parts.length === 2 && method === "GET")
      return json(await detail(id, actor));
    const conversation = await findConversation(id, actor);
    if (parts.length === 2 && method === "PATCH") {
      requireRep(actor);
      const input = await readInput(request, updateInput);
      await getDb()
        .update(conversations)
        .set({ ...input, updatedAt: Date.now() })
        .where(eq(conversations.id, id));
      return json(await detail(id, actor));
    }
    if (parts.length === 2 && method === "DELETE") {
      if (!actor.isRep && conversation.authorKey !== actor.key)
        throw new ApiError(403, "You can only delete your own conversations.");
      await getDb().delete(conversations).where(eq(conversations.id, id));
      return json({ deleted: true });
    }
    if (parts.length === 3 && parts[2] === "replies" && method === "POST") {
      const input = await readInput(request, replyInput);
      if (input.asRep) requireRep(actor);
      await rateLimit(actor, "reply", 30);
      const now = Date.now();
      const db = getDb();
      await db.batch([
        db.insert(replies).values({
          id: crypto.randomUUID(),
          conversationId: id,
          authorKey: actor.key,
          body: input.body,
          isRep: input.asRep,
          createdAt: now,
        }),
        db
          .update(conversations)
          .set({ updatedAt: now })
          .where(eq(conversations.id, id)),
      ]);
      return json(await detail(id, actor), 201);
    }
    if (parts.length === 3 && parts[2] === "vote" && method === "PUT") {
      if (conversation.visibility === "private")
        throw new ApiError(
          400,
          "Private conversations don’t have class upvotes.",
        );
      const input = await readInput(request, voteInput);
      await rateLimit(actor, "vote", 120, 60000);
      if (input.voted)
        await getDb()
          .insert(votes)
          .values({ conversationId: id, authorKey: actor.key })
          .onConflictDoNothing();
      else
        await getDb()
          .delete(votes)
          .where(
            and(eq(votes.conversationId, id), eq(votes.authorKey, actor.key)),
          );
      return json(await detail(id, actor));
    }
    if (parts.length === 3 && parts[2] === "report" && method === "POST") {
      const input = await readInput(request, reportInput);
      await rateLimit(actor, "report", 10, 3600000);
      await getDb()
        .insert(reports)
        .values({
          conversationId: id,
          authorKey: actor.key,
          reason: input.reason,
          createdAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: [reports.conversationId, reports.authorKey],
          set: { reason: input.reason },
        });
      return json({ reported: true });
    }
    if (parts.length === 3 && parts[2] === "reports" && method === "GET") {
      requireRep(actor);
      const rows = await getDb()
        .select({ reason: reports.reason, createdAt: reports.createdAt })
        .from(reports)
        .where(eq(reports.conversationId, id))
        .orderBy(desc(reports.createdAt));
      return json({ reports: rows });
    }
    throw new ApiError(405, "That action isn’t available.");
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.message }, error.status);
    console.error(
      "RepApp API failure:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      { error: "Something went wrong. Please try again in a moment." },
      500,
    );
  }
}
