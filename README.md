# Yaadvaan
Yaadvaan is a simple, culturally familiar cognitive game app designed for people with early-stage dementia. It uses personalized games to support memory, attention, language, and executive function, with caregiver and family involvement. Patient-friendly facial recognition enables easy access and adaptive gameplay.

## Contents

1. [What the app does](#what-the-app-does)
2. [Games](#games)
3. [Adaptive difficulty](#adaptive-difficulty)
4. [Offline database](#offline-database)
5. [Voice](#voice)
6. [Caregiver dashboard data](#caregiver-dashboard-data)
7. [Repository structure](#repository-structure)
8. [Setup](#setup)
9. [Configuration](#configuration)
10. [Planned features](#planned-features)
11. [Disclaimer](#disclaimer)

## What the app does

- Identifies the patient with face recognition.
- Presents cognitive games to the patient with an Assamese interface and audio prompts.
- Follows a four-games-per-day structure, one game per cognitive domain, based on the NIMHANS model. Two games covering two different domains are built.
- Chooses the next difficulty automatically from previous results. The patient never selects a level.
- Saves every session to a local SQLite database that works without an internet connection.
- Stores each session with a sync flag so results can later be uploaded when a cloud backend exists.
- Keeps performance scores out of the patient interface. Scores and session analytics are read on the caregiver dashboard.
- Lets the caregiver add medicines and appointments for the patient.

## Games

The daily structure is four games, one per cognitive domain. Two are implemented:

| Domain | Game |
|---|---|
| Visual attention and sequencing | Count Next |
| Memory | Memory Match |

Two domains remain to be added.

### Count Next

Domain: visual attention and sequencing.

The patient finds and taps the numbers 1, 2, 3, ... in order on a randomly shuffled grid.

- The game ends when all numbers are found or when 5 mistakes are made.
- After a wrong tap, the game re-prompts the next number.
- After 15 seconds without a tap, an encouragement message is shown and played.
- Score is `100 - 20 x mistakes` (0 to 100). It is stored, not shown to the patient.
- Audio uses pre-recorded local Assamese files (`audio/assamese/count_next_intro.wav`, `correct.wav`, `keep_going.wav`).

### Memory Match

Domain: memory.

The patient flips cards to find matching pairs of pictures. The 16 pictures are regionally relevant (tea garden, Bihu dance, namghar, japi, xorai, Kamakhya temple, living root bridge and similar).

- A mismatched pair flips back after 1.4 seconds.
- After 20 seconds without a tap, an encouragement popup is shown and spoken.
- A performance score (0 to 100) is calculated at the end of the session (see below).
- The starting difficulty for a new patient is E2.

## Adaptive difficulty

The next session's difficulty is decided from the last session. A new patient starts at the baseline for each game.

### Count Next

Nine steps, one step per game:

| Step | Level | Tier | Numbers | Grid |
|---|---|---|---|---|
| 1 | 1 | easy | 9 | 3 x 3 |
| 2 | 1 | medium | 15 | 3 x 5 |
| 3 | 1 | hard | 20 | 4 x 5 |
| 4 | 2 | easy | 24 | 4 x 6 |
| 5 | 2 | medium | 28 | 4 x 7 |
| 6 | 2 | hard | 30 | 5 x 6 |
| 7 | 3 | easy | 32 | 4 x 8 |
| 8 | 3 | medium | 36 | 6 x 6 |
| 9 | 3 | hard | 42 | 6 x 7 |

Rule, based on mistakes in the previous session:

| Mistakes | Next step |
|---|---|
| 0 to 1 | one step up |
| 2 to 3 | same step |
| 4 to 5 | one step down |

The decision is made in `resolveAdaptiveLevel(patientId)`, which reads the most recent session from SQLite.

### Memory Match

Nine difficulty levels, one step per game:

| ID | Pairs | Cards | Columns |
|---|---|---|---|
| E1 | 3 | 6 | 3 |
| E2 | 4 | 8 | 4 |
| E3 | 5 | 10 | 5 |
| M1 | 6 | 12 | 4 |
| M2 | 8 | 16 | 4 |
| M3 | 10 | 20 | 5 |
| H1 | 12 | 24 | 6 |
| H2 | 14 | 28 | 7 |
| H3 | 16 | 32 | 8 |

Rule, based on the performance score:

| Score | Next level |
|---|---|
| below 60 | one step down |
| 60 to 69 | same level |
| 70 or above | one step up |

Performance score weights:

| Component | Weight |
|---|---|
| Accuracy (successful matches / moves) | 50% |
| Completion | 20% |
| Speed (move efficiency 70%, duration 30%) | 15% |
| Error control (mistake rate and repeated-card errors) | 10% |
| Consistency (idle events, repeated errors, selection-interval variance) | 5% |

Optionally, the next level can be requested from Gemini (`gemini-2.5-flash`). The response is validated against the score rule above and against a maximum change of one step. Any invalid or conflicting response, a missing API key or a network failure falls back to the local rule, so the game works offline.

## Offline database

`sqlite/offline-db.js` is a helper that talks to a SQLite instance running in a Web Worker (`sqlite/sqlite-worker.js`) through request/response messages. It exposes these functions on `window`:

| Function | Purpose |
|---|---|
| `initSQLite()` | Initialise the database |
| `saveGameResult({...})` | Save one session |
| `getRecentSessions(userId, gameName, limit)` | Latest sessions for a user and game |
| `getUnsyncedResults()` | Sessions not yet synced |
| `markResultAsSynced(syncId)` | Mark a session as synced |
| `getAllGameResults()` | All stored sessions |

Fields stored per session:

| Field | Description |
|---|---|
| `sync_id` | UUID generated per session |
| `user_id` | Patient ID |
| `game_name` | `Count Next` or `Memory Match` |
| `level`, `difficulty` | Difficulty played |
| `total_numbers` | Numbers (Count Next) or pairs (Memory Match) |
| `score` | 0 to 100 |
| `mistakes` | Mistake count |
| `time_taken` | Seconds |
| `reaction_times` | JSON array of intervals between selections (ms) |
| `reaction_time_std_dev` | Standard deviation of those intervals |
| `error_log` | JSON |
| `hesitation_events` | JSON, idle/hesitation count |
| `completed` | 1 or 0 |
| `completed_at` | ISO timestamp |
| `synced` | Sync flag |

No cloud backend is implemented yet, so results are not synced anywhere.

## Voice

- Count Next plays local pre-recorded Assamese audio files.
- Memory Match speaks prompts using the browser's speech synthesis (an Assamese voice if the device has one, otherwise Hindi).
- A Bhashini text-to-speech call is present in Memory Match but is disabled because no credentials are configured. Bhashini is not integrated yet.

## Caregiver dashboard data

The dashboard (`dashboard/index.html`, `script.js`, `style.css`) is the entry point that links to the games. Caregivers can add medicines and appointments for the patient from it.

Memory Match writes to browser `localStorage` for the dashboard:

| Key | Content |
|---|---|
| `patient` | Registered patient (`id`, `gamesCompleted`, `lastActive`, `sessionDuration`) |
| `gameResults` | Array of session results (score, accuracy %, duration, moves, pairs, mistakes, difficulty, timestamp) |
| `yaadavan_patient_id` | Patient ID used by the games |
| `yaadavan_memory_match_history` | Full Memory Match session history used for adaptation |

Patient ID resolution in Memory Match: the ID of the registered patient in `localStorage.patient` is used when it exists; otherwise a generated ID is stored.

## Repository structure

```
.
├── dashboard/
│   ├── games/            Count Next and Memory Match
│   ├── index.html        Caregiver dashboard
│   ├── script.js
│   └── style.css
├── sqlite/
│   ├── offline-db.js     Database helper (main thread)
│   └── sqlite-worker.js  SQLite in a Web Worker
├── server.js
├── vite.config.js
├── package.json
├── package-lock.json
└── .gitignore
```

## Setup

```bash
npm install
npm run dev
```

Requires Node.js. The dev server is Vite (`vite.config.js`). <!-- verify against the scripts in package.json -->

## Configuration

API credentials are declared as constants at the top of the Memory Match script and are empty by default:

| Constant | Purpose |
|---|---|
| `GEMINI_API_KEY` | Optional Gemini difficulty decision |
| `BHASHINI_USER_ID`, `BHASHINI_API_KEY` | Bhashini text-to-speech (not integrated) |

Do not commit keys to the repository. Keys placed in browser code are visible to every user of the page.

## Planned features

Not present in the current code.

**Patient side**

- Two more games to complete the four daily domains.
- Tapping a domain launches a random game from that domain's pool.
- Daily orientation questions (day, date, place, who is visiting) to keep the patient present.
- Recall prompts such as "do you know this movie / song".
- Family member voice layered over games, audio and video so the patient hears and remembers them.
- Research-backed games, audio and video for trauma, condition-specific needs and loneliness.
- Content to reduce anxiety, social isolation and confusion.

**Onboarding**

- Terms and conditions that ask about disabilities, used for inclusion and exclusion criteria and for adapting the interface.

**Caregiver side**

- Upload of family voice recordings, photos, songs and films.
- Reminders for medicines and appointments (in development).
- Distress detection.

**Platform**

- Firebase (Firestore) sync using the existing `synced` flag.
- Bhashini text-to-speech integration.
- Assamese-only interface extended to other North East languages.
- Gemini-based trend analysis and alerts for caregivers.
- Documented handling of biometric and health-related data under the Digital Personal Data Protection Act 2023.

## Disclaimer

Yaadavan is a cognitive engagement tool. It does not diagnose, treat or monitor any medical condition and does not replace a clinician.
