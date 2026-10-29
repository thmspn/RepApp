import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const origin = process.env.TEST_BASE_URL ?? "http://127.0.0.1:5173";
const key = () => `ra_${randomBytes(32).toString("hex")}`;
const student = key();
const other = key();
const rep = key();
const created = [];
async function api(token, path, method = "GET", body, extra = {}) {
  const response = await fetch(`${origin}/api/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }
  return { response, data };
}
const message = (visibility) => ({
  title: `RepApp integration check ${visibility}`,
  body: "This is temporary test content for verifying anonymous conversations and access control.",
  category: "academics",
  course: visibility === "private" ? "HIDDEN 101" : "TEST 101",
  visibility,
  kind: "concern",
});

test("RepApp conversation, privacy, and rep workflows", async (t) => {
  try {
    await t.test("requires a valid anonymous capability", async () => {
      const result = await api("invalid", "conversations");
      assert.equal(result.response.status, 401);
    });
    let publicId;
    let privateId;
    const baseline = (await api(other, "conversations")).data.stats.total;
    await t.test(
      "persists public and private conversations without leaking identity",
      async () => {
        for (const visibility of ["public", "private"]) {
          const result = await api(
            student,
            "conversations",
            "POST",
            message(visibility),
          );
          assert.equal(
            result.response.status,
            201,
            JSON.stringify(result.data),
          );
          const thread = result.data.conversation;
          created.push(thread.id);
          if (visibility === "public") publicId = thread.id;
          else privateId = thread.id;
          assert.equal(thread.isMine, true);
          assert.equal(thread.visibility, visibility);
          const serialized = JSON.stringify(result.data);
          assert.ok(!serialized.includes(student));
          assert.ok(!serialized.includes("authorKey"));
          assert.ok(!serialized.includes("author_key"));
        }
        const recovered = await api(student, "conversations?view=mine");
        assert.equal(recovered.data.conversations.length, 2);
      },
    );
    await t.test(
      "a second student cannot discover private content in feeds, search, stats, or courses",
      async () => {
        const result = await api(other, "conversations?q=RepApp%20integration");
        assert.ok(result.data.conversations.some((row) => row.id === publicId));
        assert.ok(
          !result.data.conversations.some((row) => row.id === privateId),
        );
        assert.equal(result.data.stats.total, baseline + 1);
        assert.ok(!result.data.courses.includes("HIDDEN 101"));
        assert.equal(
          (
            await api(
              other,
              "conversations?q=RepApp%20integration%20check%20private",
            )
          ).data.total,
          0,
        );
        const mine = await api(other, "conversations?view=mine");
        assert.equal(mine.data.total, 0);
      },
    );
    await t.test(
      "private detail and write routes consistently enforce access",
      async () => {
        for (const [suffix, method, body] of [
          ["", "GET"],
          [
            "/replies",
            "POST",
            { body: "Trying to open a private thread", asRep: false },
          ],
          ["/vote", "PUT", { voted: true }],
          [
            "/report",
            "POST",
            { reason: "A private thread should be invisible" },
          ],
          ["", "DELETE"],
        ]) {
          const result = await api(
            other,
            `conversations/${privateId}${suffix}`,
            method,
            body,
          );
          assert.equal(result.response.status, 404, `${method} ${suffix}`);
        }
      },
    );
    await t.test(
      "rep impersonation and unauthorized moderation are rejected",
      async () => {
        assert.equal(
          (
            await api(other, "conversations", "POST", {
              ...message("public"),
              kind: "update",
            })
          ).response.status,
          403,
        );
        assert.equal(
          (
            await api(other, `conversations/${publicId}`, "PATCH", {
              status: "resolved",
              pinned: true,
            })
          ).response.status,
          403,
        );
        assert.equal(
          (
            await api(other, `conversations/${publicId}/replies`, "POST", {
              body: "I am not a rep",
              asRep: true,
            })
          ).response.status,
          403,
        );
        assert.equal(
          (await api(other, `conversations/${publicId}`, "DELETE")).response
            .status,
          403,
        );
        assert.equal(
          (await api(other, "conversations?view=rep")).response.status,
          403,
        );
      },
    );
    await t.test("upvotes are idempotent and reversible", async () => {
      for (let i = 0; i < 2; i++) {
        const result = await api(
          other,
          `conversations/${publicId}/vote`,
          "PUT",
          { voted: true },
        );
        assert.equal(result.data.conversation.voteCount, 1);
        assert.equal(result.data.conversation.voted, true);
      }
      const result = await api(other, `conversations/${publicId}/vote`, "PUT", {
        voted: false,
      });
      assert.equal(result.data.conversation.voteCount, 0);
    });
    await t.test(
      "anonymous replies keep a stable nickname within a conversation",
      async () => {
        const first = await api(
          other,
          `conversations/${publicId}/replies`,
          "POST",
          { body: "I have the same question too.", asRep: false },
        );
        const second = await api(
          other,
          `conversations/${publicId}/replies`,
          "POST",
          { body: "Adding a little more context.", asRep: false },
        );
        assert.equal(first.response.status, 201);
        assert.equal(second.response.status, 201);
        assert.equal(second.data.conversation.replyCount, 2);
        assert.equal(
          second.data.replies[0].authorName,
          second.data.replies[1].authorName,
        );
        assert.equal(second.data.replies[0].isRep, false);
        assert.ok(!JSON.stringify(second.data).includes(other));
      },
    );
    await t.test(
      "reports are hidden from students and don't expose reporters",
      async () => {
        assert.equal(
          (
            await api(other, `conversations/${publicId}/report`, "POST", {
              reason: "Temporary report used by the test suite.",
            })
          ).response.status,
          200,
        );
        const studentView = await api(student, `conversations/${publicId}`);
        assert.equal(studentView.data.conversation.reportCount, 0);
        assert.equal(
          (await api(student, `conversations/${publicId}/reports`)).response
            .status,
          403,
        );
      },
    );
    await t.test("validates input and blocks cross-origin writes", async () => {
      assert.equal(
        (
          await api(student, "conversations", "POST", {
            ...message("public"),
            title: "short",
          })
        ).response.status,
        400,
      );
      assert.equal(
        (
          await api(student, "conversations", "POST", {
            ...message("public"),
            authorKey: "injected",
          })
        ).response.status,
        400,
      );
      assert.equal(
        (
          await api(student, "conversations", "POST", message("public"), {
            origin: "https://another-site.example",
          })
        ).response.status,
        403,
      );
      const malformed = await fetch(`${origin}/api/conversations`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${student}`,
          "content-type": "application/json",
        },
        body: "{",
      });
      assert.equal(malformed.status, 400);
    });
    await t.test(
      "approved local rep can read private concerns, reply, update status, and review reports",
      async () => {
        const login = await fetch(`${origin}/signin-with-chatgpt?return_to=/`, {
          redirect: "manual",
        });
        const cookies = login.headers
          .getSetCookie()
          .map((value) => value.split(";")[0])
          .join("; ");
        assert.ok(
          cookies,
          "Run this suite against npm run dev, which includes loopback-only mock sign-in.",
        );
        const headers = { cookie: cookies };
        const session = await api(rep, "session", "GET", undefined, headers);
        assert.equal(session.data.isRep, true);
        assert.equal(
          (
            await api(
              rep,
              `conversations/${privateId}`,
              "GET",
              undefined,
              headers,
            )
          ).response.status,
          200,
        );
        const reply = await api(
          rep,
          `conversations/${privateId}/replies`,
          "POST",
          {
            body: "Your rep heard this concern. Let’s follow up.",
            asRep: true,
          },
          headers,
        );
        assert.equal(reply.response.status, 201);
        assert.equal(reply.data.replies[0].isRep, true);
        const update = await api(
          rep,
          `conversations/${privateId}`,
          "PATCH",
          { status: "in-progress" },
          headers,
        );
        assert.equal(update.data.conversation.status, "in-progress");
        const author = await api(student, `conversations/${privateId}`);
        assert.equal(
          author.data.conversation.repReplyCount,
          1,
          JSON.stringify({
            counts: author.data.conversation,
            replies: author.data.replies,
          }),
        );
        assert.equal(author.data.replies[0].authorName, "Academic rep");
        const reports = await api(
          rep,
          `conversations/${publicId}/reports`,
          "GET",
          undefined,
          headers,
        );
        assert.equal(reports.data.reports.length, 1);
        assert.deepEqual(Object.keys(reports.data.reports[0]).sort(), [
          "createdAt",
          "reason",
        ]);
        const announcement = await api(
          rep,
          "conversations",
          "POST",
          {
            ...message("public"),
            title: "Temporary class update from your rep",
            kind: "update",
          },
          headers,
        );
        assert.equal(announcement.response.status, 201);
        created.push(announcement.data.conversation.id);
        assert.equal(announcement.data.conversation.pinned, true);
        await api(
          rep,
          `conversations/${announcement.data.conversation.id}`,
          "DELETE",
          undefined,
          headers,
        );
        created.pop();
      },
    );
    await t.test(
      "data responses cannot be cached as public content",
      async () => {
        const result = await api(student, `conversations/${privateId}`);
        assert.match(result.response.headers.get("cache-control"), /no-store/);
      },
    );
  } finally {
    for (const id of created)
      await api(student, `conversations/${id}`, "DELETE");
  }
});
