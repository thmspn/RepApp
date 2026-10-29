# RepApp web app

An anonymous common room for Waterloo BME ’31. Students can start class discussions or private conversations with their reps, return with an anonymous recovery key, and receive replies in the same thread.

## Run locally

Use Node.js 22.13 or newer and npm. From this directory:

```sh
npm ci
npm run build
npm run db:migrate
npm run dev
```

Open http://127.0.0.1:5173. The local D1 database persists under `.wrangler/state/`. The board starts empty; no fabricated classmates, posts, or votes are seeded. To preview the production build, use `npm start` after building and migrating.

## Student workflow

- Start a conversation, pick a topic, and optionally add a course code.
- Choose the whole class or just the reps as the audience.
- Reply, upvote public concerns, search, and filter by course or status.
- Find conversations under **My conversations**. Open the face icon in the header to save or restore the anonymous key on another browser.
- Delete your own conversations, or report a conversation to the reps.
- Conversation lists refresh every 20 seconds; open threads refresh every 15 seconds while the browser is visible.

## Academic reps

The **Are you an academic rep?** link uses the Sites sign-in flow. The server checks the verified email against the comma-separated `REP_EMAILS` runtime secret. Only approved reps can read other students’ private conversations, post verified rep replies and pinned class updates, change status, review reports, or moderate conversations. Configure actual rep accounts before sharing the app with a class.

For loopback development only, the starter supplies a simulated sign-in account, `seedy@sites.test`. Clicking rep sign-in activates its rep tools. This simulation is excluded from production. Production has no default password or client-controlled rep role.

The private hosted preview initially authorizes the project owner as a rep. Set `REP_EMAILS` to the actual rep team in Sites environment settings and deploy to apply changes. Access to the site itself remains controlled separately by Sites sharing settings.

## Privacy model

Anonymous keys are 256-bit random capabilities generated in the browser. Only their SHA-256 hashes are stored with posts, replies, votes, reports, and rate limits. Never put a recovery key in a URL or share it with anyone. A key grants control of its author’s conversations, including private threads and deletion. Lost keys cannot be recovered by email.

No student names, email addresses, IPs, or user agents are stored by the app. Rep account identities are checked at request time and are not attached to student records. Anonymous reply nicknames are specific to each conversation; official rep replies are visibly marked. Public API projections omit author hashes and reporter identities. Private records are filtered on the server for every read and write, including search, counts, and course lists. Responses use `Cache-Control: private, no-store`.

This provides anonymity inside RepApp. Sites and underlying infrastructure can process sign-in and network information. The recovery key links the author’s own activity in the database; this is not a zero-knowledge or untraceable messaging system. Per-key rate limits reduce accidental flooding, but rotating anonymous keys can bypass them. A larger public rollout would need an agreed eligibility and abuse-prevention policy.

## Validate

```sh
npm run typecheck
npm run build
# With npm run dev running in another terminal:
npm test
```

The integration suite uses temporary records and removes them afterwards. It checks private access across routes, role impersonation, moderation, idempotent votes, anonymous reply identity, reports, recovery, input validation, cross-origin writes, verified rep replies, and cache headers. Set `TEST_BASE_URL` if the dev server uses another loopback port.

## Stack and persistence

React 19, TypeScript, Vinext/Vite, Cloudflare Workers, Drizzle, and Cloudflare D1. The hosting manifest is `.openai/hosting.json`; the database schema is `db/schema.ts`. Generate new schema migrations with `npm run db:generate`, build, then run `npm run db:migrate`. Published Sites apply production migrations independently. Local and hosted databases are separate.

The repository’s original README contains the project’s origin story. `README.md` in this directory documents the bundled Sites runtime and publishing helpers.
