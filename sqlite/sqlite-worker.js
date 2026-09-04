import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

let db = null;

/*
  Initialize SQLite database.
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
    Create base table if it does not exist.
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

      score INTEGER NOT NULL,

      mistakes INTEGER NOT NULL,

      time_taken INTEGER NOT NULL,

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

    If the database was created using your
    previous version, the table already exists.

    CREATE TABLE IF NOT EXISTS will NOT add
    new columns to an existing table.

    Therefore we check existing columns and
    add the missing ones.
  */

  const tableInfo = db.exec({
    sql: `
      PRAGMA table_info(game_results);
    `,

    returnValue: "resultRows",
  });

  const existingColumns = new Set(tableInfo.map((row) => row[1]));

  /*
    Add missing columns from the
    new metrics system.
  */

  if (!existingColumns.has("level")) {
    db.exec(`
      ALTER TABLE game_results
      ADD COLUMN level INTEGER NOT NULL DEFAULT 1;
    `);
  }

  if (!existingColumns.has("difficulty")) {
    db.exec(`
      ALTER TABLE game_results
      ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'easy';
    `);
  }

  if (!existingColumns.has("total_numbers")) {
    db.exec(`
      ALTER TABLE game_results
      ADD COLUMN total_numbers INTEGER NOT NULL DEFAULT 0;
    `);
  }

  if (!existingColumns.has("reaction_times")) {
    db.exec(`
      ALTER TABLE game_results
      ADD COLUMN reaction_times TEXT NOT NULL DEFAULT '[]';
    `);
  }

  if (!existingColumns.has("reaction_time_std_dev")) {
    db.exec(`
      ALTER TABLE game_results
      ADD COLUMN reaction_time_std_dev REAL NOT NULL DEFAULT 0;
    `);
  }

  if (!existingColumns.has("error_log")) {
    db.exec(`
      ALTER TABLE game_results
      ADD COLUMN error_log TEXT NOT NULL DEFAULT '[]';
    `);
  }

  if (!existingColumns.has("hesitation_events")) {
    db.exec(`
      ALTER TABLE game_results
      ADD COLUMN hesitation_events TEXT NOT NULL DEFAULT '[]';
    `);
  }

  if (!existingColumns.has("completed")) {
    db.exec(`
      ALTER TABLE game_results
      ADD COLUMN completed INTEGER NOT NULL DEFAULT 0;
    `);
  }

  console.log("✅ SQLite database ready.");
}

/*
  Save game result.
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
  Get unsynchronized results.
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
  Mark result as synchronized.
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

        synced_at = $synced_at

      WHERE sync_id = $sync_id;
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
  Get all results.
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
  Worker message handler.
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
