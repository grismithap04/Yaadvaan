const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const admin = require("firebase-admin");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   FIREBASE
========================= */

const serviceAccount = require("./firebase/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const dbFirebase = admin.firestore();

/* =========================
   SQLITE
========================= */

const db = new sqlite3.Database("./database/memory.db", (err) => {
  if (err) {
    console.error("SQLite error:", err.message);
  } else {
    console.log("Connected to SQLite");
  }
});

/* Create table */

db.run(`
    CREATE TABLE IF NOT EXISTS game_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        mistakes INTEGER NOT NULL,
        time_taken INTEGER NOT NULL,
        completed_at TEXT NOT NULL,
        synced INTEGER DEFAULT 0
    )
`);

/* =========================
   SAVE GAME RESULT
========================= */

app.post("/api/game-result", (req, res) => {
  const { user_id, score, mistakes, time_taken, completed_at } = req.body;

  if (
    !user_id ||
    score === undefined ||
    mistakes === undefined ||
    time_taken === undefined
  ) {
    return res.status(400).json({
      success: false,
      message: "Missing game data",
    });
  }

  const sql = `
        INSERT INTO game_results
        (user_id, score, mistakes, time_taken, completed_at, synced)
        VALUES (?, ?, ?, ?, ?, 0)
    `;

  db.run(
    sql,
    [user_id, score, mistakes, time_taken, completed_at],
    function (err) {
      if (err) {
        console.error(err);

        return res.status(500).json({
          success: false,
          message: "Could not save result",
        });
      }

      console.log("Game result saved to SQLite. ID:", this.lastID);

      /* Try Firebase synchronization */

      syncToFirebase();

      res.json({
        success: true,
        message: "Game result saved locally",
        id: this.lastID,
      });
    },
  );
});

/* =========================
   SYNC SQLITE → FIREBASE
========================= */

function syncToFirebase() {
  db.all(
    `
        SELECT *
        FROM game_results
        WHERE synced = 0
        `,
    async (err, rows) => {
      if (err) {
        console.error("SQLite sync error:", err.message);

        return;
      }

      if (rows.length === 0) {
        return;
      }

      console.log("Unsynced results:", rows.length);

      for (const row of rows) {
        try {
          await dbFirebase.collection("game_results").doc(String(row.id)).set({
            local_id: row.id,
            user_id: row.user_id,
            score: row.score,
            mistakes: row.mistakes,
            time_taken: row.time_taken,
            completed_at: row.completed_at,
          });

          /* Mark as synced */

          db.run(
            `
                        UPDATE game_results
                        SET synced = 1
                        WHERE id = ?
                        `,
            [row.id],
          );

          console.log("Synced result:", row.id);
        } catch (error) {
          console.log("Firebase unavailable.");

          /*
                       Keep synced = 0.
                       It will be retried later.
                    */
        }
      }
    },
  );
}

/* =========================
   MANUAL SYNC
========================= */

app.post("/api/sync", (req, res) => {
  syncToFirebase();

  res.json({
    success: true,
    message: "Synchronization started",
  });
});

/* =========================
   GET LOCAL RESULTS
========================= */

app.get("/api/game-results/:userId", (req, res) => {
  const userId = req.params.userId;

  db.all(
    `
        SELECT *
        FROM game_results
        WHERE user_id = ?
        ORDER BY completed_at DESC
        `,
    [userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Database error",
        });
      }

      res.json({
        success: true,
        results: rows,
      });
    },
  );
});

/* =========================
   AUTOMATIC SYNC
========================= */

/*
   Every 30 seconds the server
   checks for unsynchronized
   SQLite records.
*/

setInterval(() => {
  console.log("Checking for unsynced results...");

  syncToFirebase();
}, 30000);

/* =========================
   START SERVER
========================= */

app.listen(3000, () => {
  console.log("Memory Trail server running at http://localhost:3000");
});
