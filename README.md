# Pinocchio 🤥

A phone-first bluffing game for team calls, inspired by *Fibbage: Enough About You*.
Everyone plays on their own phone: write believable lies about your colleagues, spot the truth, and fool your friends.

- **No app, no accounts.** Just a link in the call chat. Works on iPhone (Safari) and Android (Chrome).
- **No shared screen needed.** Every phone shows the question, the answers, the reveal and the scores.
- **Free to run** on GitHub Pages + Firebase's free plan.
- **Private:** answers are deleted automatically within 24 hours after the game.

---

## How it works (the short version)

| Part | What it is | Cost |
|---|---|---|
| The website | Static files on **GitHub Pages**, rebuilt automatically when you push a change | Free |
| The live game data | **Firebase Realtime Database** with anonymous sign-in | Free (Spark plan) |
| Clean-up | A daily **GitHub Action** that deletes expired rooms | Free |

The host's phone runs the game (timers, scoring). Everything is stored in Firebase, so if a phone refreshes, locks or loses its connection, it rejoins the same seat automatically.

---

## 1. Create the free Firebase backend (± 10 minutes, once)

You need a Google account. No credit card.

1. Go to **https://console.firebase.google.com** and click **Create a project** (or *Add project*).
   - Name: e.g. `pinocchio-team`.
   - Google Analytics: **turn it off** (not needed). Click **Create project**.
2. **Turn on anonymous sign-in**
   - Left menu → **Build → Authentication** → **Get started**.
   - Tab **Sign-in method** → click **Anonymous** → switch **Enable** on → **Save**.
3. **Create the database**
   - Left menu → **Build → Realtime Database** → **Create Database**.
   - Location: **Belgium (europe-west1)** (or whatever is closest to your team).
   - Choose **Start in locked mode** → **Enable**.
4. **Paste the security rules**
   - In Realtime Database, open the **Rules** tab.
   - Delete everything in the editor, then paste the full contents of the file [`database.rules.json`](database.rules.json) from this repository.
   - Click **Publish**.
5. **Get your web config**
   - Click the ⚙️ gear (top left) → **Project settings** → scroll to **Your apps** → click the **`</>`** (Web) icon.
   - App nickname: `pinocchio`. Leave "Firebase Hosting" **unchecked**. Click **Register app**.
   - You'll see a block like `const firebaseConfig = { apiKey: "...", ... }`.
6. **Paste the config into the code**
   - Open [`src/firebase-config.ts`](src/firebase-config.ts) (on GitHub: open the file → ✏️ pencil icon).
   - Replace the placeholder values with yours: `apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`.
   - ⚠️ If `databaseURL` is missing from Firebase's block, copy it from the top of the **Realtime Database** page. It looks like `https://pinocchio-team-default-rtdb.europe-west1.firebasedatabase.app`.
   - These values are **not secret**. They only identify your project; the security rules protect the data.
7. **Allow your website's address**
   - **Authentication → Settings → Authorized domains → Add domain** → `YOUR-GITHUB-NAME.github.io`.

> 💡 Whenever you change `database.rules.json` later (rare), paste it into the Rules tab again and click **Publish**.

---

## 2. Put the game online with GitHub Pages (± 10 minutes, once)

1. Create a free account on **https://github.com** if you don't have one.
2. Create a new repository: **+** (top right) → **New repository**.
   - Name: e.g. `pinocchio`. Visibility: **Public** (free GitHub Pages needs a public repo; it contains only code, never answers).
   - Don't add a README (this project has one). Click **Create repository**.
3. Upload the code. Easiest from a terminal in this folder:
   ```bash
   git remote add origin https://github.com/YOUR-GITHUB-NAME/pinocchio.git
   git push -u origin main
   ```
4. Turn on Pages: in the repository → **Settings → Pages** → under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Go to the **Actions** tab. The workflow **Deploy to GitHub Pages** runs (± 1–2 minutes). When it shows a green ✅, your game is live at:

   **`https://YOUR-GITHUB-NAME.github.io/pinocchio/`**

From now on, **every change you commit to `main` is deployed automatically**, including edits made directly on github.com.

### Automatic clean-up of old rooms (recommended, 5 minutes)

Rooms become unreadable as soon as they expire, and the app deletes expired rooms whenever a new room is created. To also delete them **every night**, give GitHub a key:

1. Firebase console → ⚙️ **Project settings → Service accounts** → **Generate new private key** → **Generate key**. A `.json` file downloads.
2. GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: open the downloaded `.json` file in a text editor, copy **everything**, and paste it here. Click **Add secret**.
3. **Delete the downloaded `.json` file** from your computer. Never commit it.
4. Test it: **Actions** tab → **Delete expired rooms** → **Run workflow**.

> GitHub pauses scheduled workflows in repositories with no activity for 60 days. Adding a monthly prompt pack keeps it active; if it's paused, the Actions tab shows a button to re-enable it.

---

## 3. Running a game night 🎉

### Before the call (optional but recommended)
1. Open the game on your phone → **Create a room**.
2. Enter your name, pick an avatar, and fill in **Who is playing?** (e.g. `Work team`). Pinocchio remembers which questions each group has already played (see [Groups](#groups-playing-with-different-people)).
3. Choose the **question pack** and **game length** (*Short* ≈ 20 min, *Standard* ≈ 30 min with 6 players).
4. Choose when people answer the personal questions:
   - **📅 Before the call:** share the link a few days ahead. Everyone answers 2 questions about themselves in their own time. The call itself is then pure play.
   - **⚡ Live:** everyone answers at the start of the game (± 3 minutes).
5. Share the **room link** in the team chat (tap **📤 Invite your team**), or show the **QR code**.

### During the call
1. Everyone opens the link on their **phone** and joins with a name and an emoji.
2. You press **Start game** at the bottom of your screen (needs 3+ players; best with 6).
3. The game runs:
   - **Round 1:** a question about a colleague, e.g. *"The weirdest job Sofie ever had was ____"*. Everyone except Sofie writes a believable lie (or taps **🎲 Lie for me**). Then everyone picks what they think is the truth, and can 👍 their favourite lie.
   - **Reveal:** you tap **Next ▶** to reveal each answer: who wrote it, who fell for it, and finally the truth. This is the fun part; take your time!
   - **Round 2:** the same, with **double points**.
   - **Final round, Truth or Lie:** everyone writes one true fact and one lie about themselves; the others guess which is true.
   - **Podium & awards:** 🤥 Best Liar, 🔍 Lie Detector, 👍 Crowd Favourite, 🕵️ The Enigma.

### 📺 Big screen (optional)
Everything works on phones alone, but if someone can share their screen on the call, open the **big-screen view** on that computer: **☰ → 📺 Big screen view → Open**, or go to `…/#/screen/ABCD` (your room code). It shows the join QR code, the questions, the reveals and the scores in large type. It only watches; it doesn't take a seat in the game. If a corporate laptop blocks the site, simply skip it.

### Host controls (bottom bar on your phone)

| Button | What it does |
|---|---|
| **Start game** | Starts the game (lobby) or starts the rounds (after "Before the call" answers). |
| **Skip ⏭ / Reveal ▶** | Ends the current writing/picking phase now. |
| **Next ▶** | Next step of the reveal / next question / next round. |
| **+30s** | Adds 30 seconds to the timer. |
| **☰ menu** | Remove a player, copy the join link, copy your **host recovery link**, end the game now, delete the room. |

- Phases **advance automatically** when everyone has answered, or when the timer runs out.
- Each screen shows **who we're still waiting for**. As host you can tap someone there to remove them.
- Players whose phone has been disconnected for 20+ seconds aren't waited for.
- **If your phone dies:** open the game again on the same phone; you're back as host. On a *different* phone, open the **host recovery link** from the ☰ menu (save it somewhere at the start, e.g. in a private note).
- Scoring: truth found = 1000, each player fooled by your lie = 500, each 👍 = 100. Round 2 and the final round count double.

### Groups: playing with different people
Pinocchio has no accounts, so it doesn't "know" your team. Instead, the host types a group name when creating a room (e.g. `Work team`, `Friends`, `Family`). The name is remembered on the host's phone.

- **Question history is kept per group.** Your work team gets fresh questions every month, even if you also play with friends on the same site.
- Use the **same group name** each month for the same team (the name isn't case-sensitive), and a **different name** for other people.
- Anyone who sets up a room with the same group name shares its history (no answers are stored in the history, only which questions were played and when).
- **Who can join a room?** Only people who have its code or link, and only before the rounds start. The host can remove anyone from the ☰ menu. Rooms and all answers disappear within 24 hours after the game.

### After the game
All answers are deleted automatically within 24 hours. You can also tap **🗑️ Delete all answers now** on the final screen.

---

## 4. Adding a new monthly prompt pack ✍️

Prompt packs are simple JSON files in the [`prompts/`](prompts/) folder. The game remembers which questions your team has already played, so you see **fresh questions first**. Adding a new pack each month keeps it fresh.

**On github.com (no tools needed):**
1. Open the `prompts` folder → **Add file → Create new file**.
2. Name it e.g. `october.json` and paste this template:

```json
{
  "id": "october",
  "name": "October special",
  "emoji": "🎃",
  "description": "Spooky season questions.",
  "prompts": [
    {
      "id": "scariest-movie",
      "me": "The scariest movie I've ever seen is ____",
      "them": "The scariest movie {name} has ever seen is ____",
      "lies": ["The Shining", "Bambi", "It", "The Ring"]
    }
  ]
}
```

3. Click **Commit changes**. The site redeploys automatically (± 2 minutes), and the pack appears on the *Create room* screen.

**Rules for a prompt:**
- `id`: short, unique, lowercase with dashes. **Never change it afterwards**; it's how the game remembers what was played.
- `me`: the question in first person, with `____` for the answer.
- `them`: the same question about someone else, with `{name}` and `____`.
- `lies`: 3–6 believable fake answers, used by **🎲 Lie for me** and to fill in when few people lied.
- Keep it light and work-friendly: no health, relationships, money or politics.
- Tip: aim for 20+ prompts per pack. Each 6-player game uses ± 8 prompts and deals 5 per player.

**Included packs:** 🎲 General (100 questions), 🏖️ Holidays & travel, 🎒 Throwback, 🍕 Food fight, 🔮 What if?

The **"questions not played yet"** counter on the *Create room* screen tells you when a pack is running low for the selected group. **Reset history** makes all of its questions "fresh" again for that group.

---

## Tweaking the game

| What | Where |
|---|---|
| Points per truth / fooled player / like, round multipliers | [`src/config/scoring.ts`](src/config/scoring.ts) |
| Timers, number of questions per round, player limits, data retention | [`src/config/game.ts`](src/config/game.ts) |
| All text on screen (e.g. to add Dutch) | [`src/i18n/en.ts`](src/i18n/en.ts) (copy to `nl.ts`, translate, register in `src/i18n/index.ts`, then use `?lang=nl`) |

---

## For developers 🛠️

```bash
npm install
npm run dev:emu     # local game + local Firebase emulator (needs Java: brew install openjdk@21)
```

Open http://localhost:5173. To test a full game alone, create a room and add bots: **☰ → Add 5 bots**, or add `?bots=5` to the room URL (`#/r/ABCD?bots=5`). Phones on the same Wi-Fi can join via your computer's IP address.

| Command | What |
|---|---|
| `npm test` | Unit tests: game engine, scoring, duplicate detection, prompt packs |
| `npm run test:rules` | Security rules tests against the emulator |
| `npm run test:e2e` | Playwright: 3 phones play a full game (iPhone + Android viewports) |
| `npm run rules` | Regenerate `database.rules.json` from `scripts/build-rules.mjs` |
| `npm run build` | Production build into `dist/` |

**Architecture.** Preact + TypeScript + Vite. `src/logic/` is pure game logic (no Firebase): `engine.ts` turns the room state into database updates. The host's phone runs it every 500 ms (`RoomScreen.tsx`). Truths and lies live under `priv/{player}` (readable only by the author and the host). The host publishes anonymised, shuffled options and keeps the answer key under `secret/`. Duplicate lies are rejected with salted hashes (`lieHashes/`), enforced by the security rules. Timers use Firebase's server clock.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Firebase is not configured yet" | Paste your config into `src/firebase-config.ts` (step 1.6) and commit. |
| Stuck on "Loading…" or "Something went wrong" | Check that **Anonymous** sign-in is enabled (1.2) and the `databaseURL` is correct (1.6). |
| Can't create a room | Re-paste `database.rules.json` into the Rules tab and **Publish** (1.4). |
| The site shows a 404 | Settings → Pages → Source must be **GitHub Actions**, and the Actions run must be green. |
| The timer doesn't move on | The host's phone drives the game; keep the game open on the host's phone (the app keeps its screen awake). |
