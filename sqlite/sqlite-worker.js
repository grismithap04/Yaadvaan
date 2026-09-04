import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

/*
  ==========================================
  DATABASE
  ==========================================
*/

let db = null;

/*
  ==========================================
  INITIALIZE DATABASE
  ==========================================
*/

async function initDatabase() {
  if (db) {
    return;
  }

  const sqlite3 = await sqlite3InitModule();

  console.log("SQLite version:", sqlite3.version.libVersion);

  /*
    Check OPFS support.
  */

  if (!sqlite3.oo1.OpfsDb) {
    throw new Error("SQLite OPFS is not available in this browser.");
  }

  /*
    Create / open persistent database.
  */

  db = new sqlite3.oo1.OpfsDb("/sih_game_results.sqlite3");

  /*
    ==========================================
    CREATE TABLE
    ==========================================
  */

  db.exec(`

    CREATE TABLE IF NOT EXISTS game_results (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      sync_id TEXT UNIQUE NOT NULL,

      user_id TEXT NOT NULL,

      game_name TEXT NOT NULL,

      level INTEGER NOT NULL DEFAULT 1,

      difficulty TEXT NOT NULL DEFAULT 'easy',

      total_numbers INTEGER NOT NULL DEFAULT 0,

      score INTEGER NOT NULL DEFAULT 0,

      mistakes INTEGER NOT NULL DEFAULT 0,

      time_taken INTEGER NOT NULL DEFAULT 0,

      reaction_times TEXT NOT NULL DEFAULT '[]',

      reaction_time_std_dev REAL NOT NULL DEFAULT 0,

      error_log TEXT NOT NULL DEFAULT '[]',

      hesitation_events TEXT NOT NULL DEFAULT '[]',

      completed INTEGER NOT NULL DEFAULT 0,

      completed_at TEXT NOT NULL,

      synced INTEGER NOT NULL DEFAULT 0,

      synced_at TEXT

    );

  `);

  /*
    ==========================================
    DATABASE MIGRATION
    ==========================================
  */

  const tableInfo = db.exec({
    sql: `PRAGMA table_info(game_results);`,

    returnValue: "resultRows",
  });

  const existingColumns = new Set(tableInfo.map((row) => row[1]));

  /*
    Add missing columns.
  */

  if (!existingColumns.has("level")) {
    db.exec(`

      ALTER TABLE game_results

      ADD COLUMN level
      INTEGER NOT NULL DEFAULT 1;

    `);
  }

  if (!existingColumns.has("difficulty")) {
    db.exec(`

      ALTER TABLE game_results

      ADD COLUMN difficulty
      TEXT NOT NULL DEFAULT 'easy';

    `);
  }

  if (!existingColumns.has("total_numbers")) {
    db.exec(`

      ALTER TABLE game_results

      ADD COLUMN total_numbers
      INTEGER NOT NULL DEFAULT 0;

    `);
  }

  if (!existingColumns.has("reaction_times")) {
    db.exec(`

      ALTER TABLE game_results

      ADD COLUMN reaction_times
      TEXT NOT NULL DEFAULT '[]';

    `);
  }

  if (!existingColumns.has("reaction_time_std_dev")) {
    db.exec(`

      ALTER TABLE game_results

      ADD COLUMN reaction_time_std_dev
      REAL NOT NULL DEFAULT 0;

    `);
  }

  if (!existingColumns.has("error_log")) {
    db.exec(`

      ALTER TABLE game_results

      ADD COLUMN error_log
      TEXT NOT NULL DEFAULT '[]';

    `);
  }

  if (!existingColumns.has("hesitation_events")) {
    db.exec(`

      ALTER TABLE game_results

      ADD COLUMN hesitation_events
      TEXT NOT NULL DEFAULT '[]';

    `);
  }

  if (!existingColumns.has("completed")) {
    db.exec(`

      ALTER TABLE game_results

      ADD COLUMN completed
      INTEGER NOT NULL DEFAULT 0;

    `);
  }

  if (!existingColumns.has("synced")) {
    db.exec(`

      ALTER TABLE game_results

      ADD COLUMN synced
      INTEGER NOT NULL DEFAULT 0;

    `);
  }

  if (!existingColumns.has("synced_at")) {
    db.exec(`

      ALTER TABLE game_results

      ADD COLUMN synced_at
      TEXT;

    `);
  }

  console.log("✅ SQLite database ready.");
}

/*
  ==========================================
  SAVE RESULT
  ==========================================
*/

async function saveResult(data) {
  if (!db) {
    await initDatabase();
  }

  db.exec({
    sql: `

      INSERT INTO game_results (

        sync_id,

        user_id,

        game_name,

        level,

        difficulty,

        total_numbers,

        score,

        mistakes,

        time_taken,

        reaction_times,

        reaction_time_std_dev,

        error_log,

        hesitation_events,

        completed,

        completed_at,

        synced

      )

      VALUES (

        $sync_id,

        $user_id,

        $game_name,

        $level,

        $difficulty,

        $total_numbers,

        $score,

        $mistakes,

        $time_taken,

        $reaction_times,

        $reaction_time_std_dev,

        $error_log,

        $hesitation_events,

        $completed,

        $completed_at,

        0

      );

    `,

    bind: {
      $sync_id: data.sync_id,

      $user_id: data.user_id,

      $game_name: data.game_name,

      $level: data.level,

      $difficulty: data.difficulty,

      $total_numbers: data.total_numbers,

      $score: data.score,

      $mistakes: data.mistakes,

      $time_taken: data.time_taken,

      $reaction_times: data.reaction_times,

      $reaction_time_std_dev: data.reaction_time_std_dev,

      $error_log: data.error_log,

      $hesitation_events: data.hesitation_events,

      $completed: data.completed,

      $completed_at: data.completed_at,
    },
  });

  return {
    success: true,

    message: "Game result saved to SQLite.",
  };
}

/*
  ==========================================
  GET RECENT SESSIONS
  ==========================================
*/

async function getRecentSessions(
  userId,

  gameName,

  limit = 3,
) {
  if (!db) {
    await initDatabase();
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 3, 20));

  return db.exec({
    sql: `

      SELECT

        id,

        sync_id,

        user_id,

        game_name,

        level,

        difficulty,

        total_numbers,

        score,

        mistakes,

        time_taken,

        reaction_times,

        reaction_time_std_dev,

        error_log,

        hesitation_events,

        completed,

        completed_at,

        synced

      FROM game_results

      WHERE user_id =
        $user_id

      AND game_name =
        $game_name

      ORDER BY
        id DESC

      LIMIT ${safeLimit};

    `,

    bind: {
      $user_id: userId,

      $game_name: gameName,
    },

    returnValue: "resultRows",
  });
}

/*
  ==========================================
  GET UNSYNCED RESULTS
  ==========================================
*/

async function getUnsyncedResults() {
  if (!db) {
    await initDatabase();
  }

  return db.exec({
    sql: `

      SELECT

        id,

        sync_id,

        user_id,

        game_name,

        level,

        difficulty,

        total_numbers,

        score,

        mistakes,

        time_taken,

        reaction_times,

        reaction_time_std_dev,

        error_log,

        hesitation_events,

        completed,

        completed_at

      FROM game_results

      WHERE synced = 0

      ORDER BY id ASC;

    `,

    returnValue: "resultRows",
  });
}

/*
  ==========================================
  MARK RESULT AS SYNCHRONIZED
  ==========================================
*/

async function markAsSynced(syncId) {
  if (!db) {
    await initDatabase();
  }

  db.exec({
    sql: `

      UPDATE game_results

      SET

        synced = 1,

        synced_at =
          $synced_at

      WHERE sync_id =
        $sync_id;

    `,

    bind: {
      $sync_id: syncId,

      $synced_at: new Date().toISOString(),
    },
  });

  return {
    success: true,
  };
}

/*
  ==========================================
  GET ALL RESULTS
  ==========================================
*/

async function getAllResults() {
  if (!db) {
    await initDatabase();
  }

  return db.exec({
    sql: `

      SELECT *

      FROM game_results

      ORDER BY id DESC;

    `,

    returnValue: "resultRows",
  });
}

/*
  ==========================================
  CLEAR ALL RESULTS
  ==========================================

  This is ONLY for testing/resetting
  the prototype.

  It is NOT called automatically.
  ==========================================
*/

async function clearAllResults() {
  if (!db) {
    await initDatabase();
  }

  db.exec(`

    DELETE FROM game_results;

  `);

  /*
    Reset SQLite AUTOINCREMENT counter.
  */

  db.exec(`

    DELETE FROM sqlite_sequence

    WHERE name =
      'game_results';

  `);

  return {
    success: true,

    message: "All game results deleted.",
  };
}

/*
  ==========================================
  WORKER MESSAGE HANDLER
  ==========================================
*/

self.onmessage = async (event) => {
  const { action, data, requestId } = event.data;

  try {
    /*
        INITIALIZE
      */

    if (action === "init") {
      await initDatabase();

      self.postMessage({
        requestId,

        success: true,
      });

      return;
    }

    /*
        SAVE RESULT
      */

    if (action === "saveResult") {
      const result = await saveResult(data);

      self.postMessage({
        requestId,

        ...result,
      });

      return;
    }

    /*
        GET RECENT SESSIONS
      */

    if (action === "getRecentSessions") {
      const results = await getRecentSessions(
        data.user_id,

        data.game_name,

        data.limit,
      );

      self.postMessage({
        requestId,

        success: true,

        results,
      });

      return;
    }

    /*
        GET UNSYNCED
      */

    if (action === "getUnsynced") {
      const results = await getUnsyncedResults();

      self.postMessage({
        requestId,

        success: true,

        results,
      });

      return;
    }

    /*
        MARK SYNCED
      */

    if (action === "markSynced") {
      const result = await markAsSynced(data.sync_id);

      self.postMessage({
        requestId,

        ...result,
      });

      return;
    }

    /*
        GET ALL
      */

    if (action === "getAll") {
      const results = await getAllResults();

      self.postMessage({
        requestId,

        success: true,

        results,
      });

      return;
    }

    /*
        CLEAR ALL
      */

    if (action === "clearAll") {
      const result = await clearAllResults();

      self.postMessage({
        requestId,

        ...result,
      });

      return;
    }

    /*
        UNKNOWN ACTION
      */

    throw new Error(`Unknown SQLite action: ${action}`);
  } catch (error) {
    console.error("SQLite error:", error);

    self.postMessage({
      requestId,

      success: false,

      error: error instanceof Error ? error.message : String(error),
    });
  }
};
