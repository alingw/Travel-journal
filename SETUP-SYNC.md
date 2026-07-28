# Cloud sync setup — edit trips via GitHub with 4-digit codes

This makes trips shareable: you publish a trip and assign it a **4-digit code**;
anyone you give the code to can open it, edit, and their changes are saved back to
a **private GitHub repo** — through a tiny free serverless function (so no one ever
needs your GitHub token). Reading a trip also requires the code (data repo is private).

```
Editor ──code──▶  Vercel function (holds token)  ──GitHub API──▶  private data repo
                     ▲ only it can read/write                     trips/<id>.json
```

## One-time setup (~10 minutes)

### 1. Put this app on GitHub
Create a repo (e.g. `travel-journal`) and push this project to it.

### 2. Create a PRIVATE data repo
Create a second, **private** repo, e.g. `travel-data`. Leave it empty — the app
creates `trips/<id>.json` files in it automatically. This is where trip data lives.

### 3. Create a fine-grained GitHub token
GitHub → Settings → Developer settings → **Fine-grained personal access tokens** →
Generate new token:
- **Repository access:** Only select repositories → your `travel-data` repo.
- **Permissions:** Repository permissions → **Contents: Read and write**.
- Generate and copy the token (starts with `github_pat_…`).

### 4. Deploy to Vercel (free)
- Go to vercel.com → **Add New Project** → import your `travel-journal` repo.
- Framework preset auto-detects **Vite**. Leave build settings as-is
  (`vercel.json` in this repo already wires it up).
- Add **Environment Variables**:
  | Name | Value |
  |------|-------|
  | `GITHUB_TOKEN` | the fine-grained token from step 3 |
  | `DATA_REPO` | `your-username/travel-data` |
  | `OWNER_KEY` | a long random secret you invent (your admin password) |
- Deploy. You'll get a URL like `https://travel-journal-xyz.vercel.app`.

The app **and** the sync API are served from that one URL (`/` = app,
`/api/trips` = function), so there's no CORS to configure.

### 5. Create your first trip
Open your Vercel URL — you'll land on the **intro page**. The app already knows to
talk to its own `/api/trips`, so there's nothing to configure. Then:
- Click **＋ Create a new trip**.
- Fill in the name / city / dates, choose a **4-digit code**, and enter your
  **`OWNER_KEY`** (the one you set in Vercel — it's remembered on your device after).
- **Create & open** → you're in the journal, editing in sync mode (**☁✓**).

## Sharing & editing
Give someone **the app URL + the 4-digit code** — that's it. They open the URL,
type the code on the intro page, and **Open →** straight into the journal. Every
change autosaves to your private `travel-data` repo (`☁…` saving, `☁✓` synced). If
two people edit at once, whoever saves second is told and gets the latest reloaded
(no silent loss).

- **☁✓** synced · **☁…** saving · **☁⚠** another editor saved (reloaded) · **☁!** error
- The **☁ Trip menu** (top right) shows/copies the code, lists your codes, and
  **Leave / switch trip** takes you back to the intro page.
- Only the **owner** (with the owner key) can create trips; everyone else can only
  open with a code.

## Testing locally first (optional)
Run the included mock (no GitHub needed):
```bash
node dev/mock-sync-server.mjs
```
On the intro page → **advanced**, set the Sync URL to `http://localhost:8787`, then
create a trip using owner key `test-owner`, or open one by its code.

## Security notes — please read
- **4-digit codes are weak on purpose** (10,000 combinations). Anyone who has the app
  URL could try to guess a trip's code. That's fine for sharing a trip plan with
  friends/family, but don't store anything sensitive. If you want stronger protection
  later, I can widen the code length or add rate-limiting to the function.
- The **data repo is private** and only the serverless function (with your token) can
  read/write it — the token is never exposed to editors or in the browser.
- Keep **`OWNER_KEY`** secret; it's what lets you create trips and change codes.
- The token is **fine-grained to the data repo only**, so even if leaked it can't touch
  your other repos.
