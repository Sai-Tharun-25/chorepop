# ChorePop ✨

A bright, lightweight, **installable household chore rotation app** with hosted data and optional iPhone push notifications. No paid hosting, no paid database, no Apple developer account and no recurring paid service are required for a small household staying within Cloudflare's Free-plan quotas.

## How rotation works

Every chore has **its own** current assignee and moves through **the same shared member order** on completion.

Example: if People is `Alex → Ben → Casey → Dani → Eli`, a chore will go `Alex → Ben → Casey → Dani → Eli → Alex ...`. Each chore advances **only when its current assignee taps Done**, not by calendar date. You can choose the first member when creating a chore. Adding another member appends to the rotation; removing someone passes any chores currently assigned to that person to the next person. There are no due dates.

### Early completion credits (v1.1)

When someone else does a chore outside their turn, they select their own name and tap **⚡ I did it early**. They earn **one skip credit for that chore only**; the currently assigned member does **not** change and continues receiving reminders. When the volunteer's own turn comes around, ChorePop automatically skips that person **once**, consumes the credit, and assigns the turn to the next eligible member. Credits do not stack; a person can hold at most one credit per chore. The early completion appears in Activity. If everyone ahead in the queue has a credit, the app consumes those credits and resumes the normal cycle.

**Upgrade an already deployed database before deploying this release:**

```bash
npx wrangler d1 execute chorepop-db --remote --file=./migrations/001_early_credits.sql
npm run deploy
```

This migration adds tables without deleting existing members, chores or history. A new install can just use `npm run db:remote` as before; the new schema includes these tables.

Push notifications (if enabled by each member):

- Attempt immediately when a chore becomes your turn (either first assigned or handed off).
- Attempt a reminder after 24 hours and about every 24 hours thereafter until completed. The Cloudflare hourly job introduces up to about an hour of scheduling delay; browser/device notification delivery itself is best-effort.
- One person with several subscribed devices can receive notifications on each of those devices.

## Hosting architecture

**One Cloudflare Worker** hosts both the PWA files and the API. **Cloudflare D1** stores members, chores, completion history and push subscriptions. A Worker **Cron Trigger** checks reminders hourly. Standard encrypted Web Push uses a bundled library; no email/SMS vendor required.

Everything shared is stored in D1; browsers only save the chosen identity and household access code for convenience. The browser never acts as the source of truth for chores. The service worker does **not** store offline chore data.

## Deployment — start to finish

Prerequisite: free Cloudflare account, Node.js 20+ and npm installed on your computer. You deploy once from your own computer. You do **not** need to leave that computer running.

1. Open this folder in Terminal or VS Code. Run:

   ```bash
   npm install
   npx wrangler login
   npx wrangler d1 create chorepop-db
   ```

2. Copy the **database ID** shown by the creation command into `wrangler.toml` by replacing `00000000-0000-0000-0000-000000000000`. If you have an existing D1 database of the same name, use that database's ID instead.

3. Create the tables in the **hosted** database:

   ```bash
   npm run db:remote
   ```

4. Generate the private household code and push notification keys:

   ```bash
   npm run keys
   ```

   Keep the four lines printed by this command. Change `VAPID_SUBJECT` to `mailto:` plus an actual email address you control (used only to identify your push server). **Do not publish the private key or household code.**

5. Store the four generated values as **Cloudflare Worker secrets**, running each line and pasting its corresponding value when prompted:

   ```bash
   npx wrangler secret put HOUSEHOLD_CODE
   npx wrangler secret put VAPID_PUBLIC_KEY
   npx wrangler secret put VAPID_PRIVATE_KEY
   npx wrangler secret put VAPID_SUBJECT
   ```

   Wrangler may deploy an initial Worker when secrets are created; that's okay. The last deployment step publishes the completed app.

6. Deploy:

   ```bash
   npm run deploy
   ```

   Open the `https://chorepop-home.<your-cloudflare-subdomain>.workers.dev` URL returned by Wrangler. Enter your `HOUSEHOLD_CODE`, add household members, then add chores.

7. From **Settings → Share link**, send the link to your housemates privately. Each housemate opens the link and taps their own name in the app. The link embeds the access code, so only send it to trusted household members.

### Install on iPhone and turn on notifications

1. Open the deployed link **in Safari** on your iPhone.
2. Use **Share → Add to Home Screen**, then add ChorePop. (On newer iOS versions enable **Open as Web App** if shown.)
3. **Open the installed ChorePop icon**, tap your name, then tap **Enable reminders**.
4. Accept the notification permission. Repeat for each household member's iPhone.

For iPhone push notifications, **iOS 16.4+** and installation to the Home Screen are required. Notification delivery depends on the phone's settings, network and push service and cannot be guaranteed. The app itself remains usable in Safari without notifications.

### Test locally (optional)

1. Run `npm run keys` and copy the four generated lines into `.dev.vars` in the project root, using `.dev.vars.example` as your guide. Never commit `.dev.vars` to Git.
2. After replacing the database ID in the Wrangler config, run:

   ```bash
   npm run db:local
   npm run dev
   ```

3. Open `http://localhost:8787`. Local web push might not behave the same way as push on a deployed, HTTPS PWA, especially on iPhone.

### What the app can do

- Add, rename or remove members; their list defines the cyclic order.
- Add, rename or delete chores; choose which member starts each rotation.
- Separate rotation per chore; only a manual **Done** advances the turn.
- See what is assigned to you vs. everyone else; view recent completion history.
- Share one private invite link; each phone selects an identity.
- Opt in or out of notifications on each device, including iPhone Home Screen PWAs.
- Reacts to changes from other devices on refresh, returning to the app, or approximately once per minute while open.

### Privacy and limitations

This is intentionally **one private household per deployment**, without accounts. Anyone with the private household code can select any member, mark their chores done, modify or delete data. The name selection is for convenience, **not secure verification of identity**. Don't put sensitive information in your chore names. This is a trusted-housemates app, not a multi-tenant public SaaS.

This simple version doesn't include an undo button, rigid day-of-week scheduling or offline editing, since turns move forward only on completion. Recent history shows the last 40 completions; full history remains in D1.

Cloudflare services have quotas. Cloudflare Workers Free currently includes 100,000 Worker requests/day (static asset requests are free) and up to 5 cron triggers; Cloudflare D1 Free includes 5 million read rows/day, 100,000 written rows/day, and 5 GB storage. A normal five-person household is far below these limits. On the free plan, reaching limits results in throttling/errors, not usage-based charges. These are **current documented limits, not a permanent promise**. The Worker and database are managed, but occasional maintenance or updates may still be needed if browser or provider requirements change.

## Troubleshooting

- **Incorrect household code**: Verify that the `HOUSEHOLD_CODE` secret exactly matches the one you entered; share the link again.
- **Database error**: Ensure `database_id` is correct and `npm run db:remote` ran successfully.
- **No push permission on iPhone**: Open the actual installed Home Screen app, not a Safari tab; confirm iOS version is supported, then use Settings → Push reminders → Enable.
- **Push permission accepted but no alerts**: Confirm `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` were set and generated as a matched pair; enable on that person's own phone; check Cloudflare Worker logs with `npx wrangler tail` for push-send errors. Cloudflare scheduled changes can take several minutes to propagate.
- **Changing household code**: Update the Worker secret with `npx wrangler secret put HOUSEHOLD_CODE` and re-share fresh links. Everyone will need the new code.
- **Private code leaked**: Immediately change the household code; the URL is a bearer secret.

## Development checks

```bash
npm test
node --check src/index.js
node --check public/app.js
```
