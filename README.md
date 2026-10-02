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

## Your setup (already done ✅)

Everything is set up and running. You don't need to do anything here; this is just where things live.

| What | Where |
|---|---|
| 🎮 The game | **https://smetsson.github.io/pinocchio/** |
| 💻 The code | https://github.com/smetsson/pinocchio: every change committed to `main` is published automatically (± 1 minute, see the **Actions** tab) |
| 🔥 The backend | Firebase project **`pinocchio-smetsson`**: https://console.firebase.google.com/project/pinocchio-smetsson (Realtime Database in Belgium, anonymous sign-in) |
| 🧹 Clean-up | GitHub Action **Delete expired rooms** runs every night; it uses the `FIREBASE_SERVICE_ACCOUNT` secret |
| 🔒 Key lock | The Firebase web key only works from `smetsson.github.io` (and Firebase's own sign-in domain), so other websites can't use your free quota. If you ever move the game to another address, add it in [Google Cloud → Credentials](https://console.cloud.google.com/apis/credentials?project=pinocchio-smetsson) → *Browser key* → *Website restrictions*. |
| 🖼️ Link preview | The image and text shown when you paste the link in Teams/WhatsApp: `public/og-image.png` (redraw with `node scripts/make-og-image.mjs`) and the `og:` tags in `index.html`. |

> GitHub pauses scheduled workflows in repositories with no activity for 60 days. Adding a monthly prompt pack keeps it active; if it's ever paused, the Actions tab shows a button to re-enable it. Expired rooms are unreadable either way.

---

## Running a game night 🎉

### Before the call (optional but recommended)
1. Open the game on your phone → **Create a room**.
2. Enter your name, pick an avatar, and fill in **Who is playing?** (e.g. `Work team`). Pinocchio remembers which questions each group has already played (see [Groups](#groups-playing-with-different-people)).
3. Choose the **question pack** and **game length**: *Short* plays 3 + 3 questions (≈ 20 min); *Full* plays every player's 2 answers (≈ 40 min with 6 players).
4. Choose when people answer the personal questions:
   - **📅 Before the call:** share the link a few days ahead. Everyone answers 2 questions about themselves in their own time. The call itself is then pure play.
   - **⚡ Live:** everyone answers at the start of the game (± 3 minutes).
5. Share the **room link** in the team chat (tap **📤 Invite your team**), or show the **QR code**.

### During the call
1. Everyone opens the link on their **phone** and joins with a name and an emoji.
2. You press **Start game** at the bottom of your screen (needs 3+ players; best with 6).
3. The game runs (each round starts with a short title card, so everyone on the call knows where you are):
   - **Round 1:** a question about a colleague, e.g. *"The weirdest job Sofie ever had was ____"*. Everyone except Sofie writes a believable lie (or taps **🎲 Lie for me**). Then everyone picks what they think is the truth, and can 👍 their favourite lie.
   - **Reveal:** you tap **Next ▶** to reveal each answer: who wrote it, who fell for it, and finally (after a little drumroll 🥁) the truth. This is the fun part; take your time!
   - **Scoreboard** after each round: points count up and arrows show who climbed or dropped.
   - **Round 2:** the same, with **double points**.
   - **Final round, Truth or Lie:** everyone writes one true fact and one lie about themselves; the others guess which is true (normal points).
   - **Podium & awards:** 🤥 Best Liar, 🔍 Lie Detector, 👍 Crowd Favourite, 🕵️ The Enigma.
4. **Someone joins late?** No problem: they can open the link and jump in any time before the podium. They write lies and vote from then on (they just won't be asked about themselves in rounds 1–2).
5. **Another round?** On the podium screen, tap **🔁 Play again with the same players**. Everyone's phone (and the big screen) moves to the new game by itself, and you get fresh questions.

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
- **Answers are shown in capitals** and tidied (spacing, full stops), so nobody's typing habits give them away.
- Each screen shows **who we're still waiting for**. As host you can tap someone there to remove them.
- Players whose phone has been disconnected for 20+ seconds aren't waited for.
- **If you leave the game on your phone** (e.g. to check the call chat) for more than 15 seconds, the first player who's still connected **automatically takes over as host**, so the game keeps going for everyone. Their phone says *"You're hosting until … is back"*. When you come back, you get hosting back automatically.
- **If your phone dies:** open the game again on the same phone; you're back as host. On a *different* phone, open the **host recovery link** from the ☰ menu (save it somewhere at the start, e.g. in a private note).
- Scoring: truth found = 1000, each player fooled by your lie = 500, each 👍 = 100. **Round 2 counts double.** The final round counts normally: each guess there is a 50/50 pick, so doubling it would let luck decide the winner.

### Groups: playing with different people
Pinocchio has no accounts, so it doesn't "know" your team. Instead, the host types a group name when creating a room (e.g. `Work team`, `Friends`, `Family`). The name is remembered on the host's phone.

- **Question history is kept per group.** Your work team gets fresh questions every month, even if you also play with friends on the same site.
- Use the **same group name** each month for the same team (the name isn't case-sensitive), and a **different name** for other people.
- Anyone who sets up a room with the same group name shares its history (no answers are stored in the history, only which questions were played and when).
- **Who can join a room?** Only people who have its code or link, and only until the podium. The host can remove anyone from the ☰ menu. Rooms and all answers disappear within 24 hours after the game.

### After the game
All answers are deleted automatically within 24 hours. You can also tap **🗑️ Delete all answers now** on the final screen.

---

## Adding a new monthly prompt pack ✍️

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
- If the answer is usually *one ordinary thing* (an animal, a gadget, a costume), write the question as a label: `"My favourite animal: ____"`, with suggestions without "a/an/the" (`"red panda"`). The game then drops a leading "a/an/the" from what people type, so "a hippo" and "hippo" look the same.
- Keep it light and work-friendly: no health, relationships, money or politics.
- **Standard pack size: 50 questions** (a test checks this, so a smaller pack won't deploy). Every player is dealt 5 questions (2 to answer + 3 spares), and a room holds up to 10 players, so 50 guarantees nobody in a game gets the same question as someone else. A 6-player game plays ± 8 questions, so a pack lasts about 6 games before questions repeat for your group.

**Included packs:** 🎲 General (100 questions), 🔮 What if? (50), 🏖️ Holidays & travel (50), 🎒 Throwback (50), 🍕 Food fight (50)

The **"questions not played yet"** counter on the *Create room* screen tells you when a pack is running low for the selected group. **Reset history** makes all of its questions "fresh" again for that group.

---

## Tweaking the game

| What | Where |
|---|---|
| Points per truth / fooled player / like, round multipliers | [`src/config/scoring.ts`](src/config/scoring.ts) |
| Timers, number of questions per round, player limits, data retention | [`src/config/game.ts`](src/config/game.ts) |
| All text on screen (buttons, messages, award names) | [`src/i18n/en.ts`](src/i18n/en.ts) |

---

## For developers 🛠️

```bash
npm install
npm run dev:emu     # local game + local Firebase emulator (needs Java: brew install openjdk@21)
```

Open http://localhost:5173. Phones on the same Wi-Fi can join via your computer's IP address.

**Testing a full game alone** (works locally and on the live site): create a room, then add these to the room link:

| Add to the link | What it does |
|---|---|
| `?bots=5` | 5 bot players join (also: **☰ → Add 5 bots** in the lobby) |
| `&autoplay` | a bot also plays **your** seat, and the reveals move on by themselves |
| `&fast` | all timers 5× shorter |

For example `…/#/r/ABCD?bots=5&autoplay&fast` plays a whole game by itself in about 2 minutes. On the live site, use a separate group name (e.g. `Test`) so tests don't use up your team's fresh questions.

| Command | What |
|---|---|
| `npm test` | Unit tests: game engine, scoring, duplicate detection, prompt packs |
| `npm run test:rules` | Security rules tests against the emulator |
| `npm run test:e2e` | Playwright: 3 phones play a full game (iPhone + Android viewports) |
| `npm run rules` | Regenerate `database.rules.json` from `scripts/build-rules.mjs` |
| `npx firebase deploy --only database -P prod` | Upload `database.rules.json` to the live Firebase project (after changing the rules; needs `npx firebase login` once) |
| `npm run build` | Production build into `dist/` |

**Architecture.** Preact + TypeScript + Vite. `src/logic/` is pure game logic (no Firebase): `engine.ts` turns the room state into database updates. The host's phone runs it every 500 ms (`RoomScreen.tsx`). Truths and lies live under `priv/{player}` (readable only by the author and the host). The host publishes anonymised, shuffled options and keeps the answer key under `secret/`. Duplicate lies are rejected with salted hashes (`lieHashes/`), enforced by the security rules. Timers use Firebase's server clock. If the host's page is hidden for 15+ s mid-game, the first connected player's phone claims the host seat (`meta/hostPid`, then `meta/hostUid`; the rules only allow this while the host is away), and the room's creator (`meta/ownerPid`) takes it back on return. "Play again" writes a new room with the same players and sets `pub/next` on the old one; every phone follows.

## Troubleshooting

| Problem | Fix |
|---|---|
| The timer doesn't move on | The host's phone runs the game. If the host leaves the game for 15+ seconds, another player takes over automatically; if *nobody* has the game open, it waits until someone is back. |
| The host's phone died | Open the game again on the same phone, or open the **host recovery link** (☰ menu) on another phone. |
| Someone can't join | Players can join until the podium. Check the room code; rooms expire 24 hours after the game. |
| A change isn't live yet | Check the **Actions** tab on GitHub: the latest **Deploy to GitHub Pages** run must be green ✅. Then refresh the page. |
| "Something went wrong" / stuck on "Loading…" | Check https://status.firebase.google.com, and that **Anonymous** sign-in is still enabled in the Firebase console (Authentication → Sign-in method). |
