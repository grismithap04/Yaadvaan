const sqliteWorker = new Worker(
  new URL("./sqlite-worker.js", import.meta.url),
  {
    type: "module",
  },
);

const pendingRequests = new Map();

let requestCounter = 0;

/*
  Worker response handler.
*/

sqliteWorker.onmessage = (event) => {
  const { requestId, ...response } = event.data;

  const resolver = pendingRequests.get(requestId);

  if (!resolver) {
    return;
  }

  pendingRequests.delete(requestId);

  resolver(response);
};

/*
  Worker error handler.
*/

sqliteWorker.onerror = (error) => {
  console.error("SQLite Worker Error:", error);
};

/*
  Send request to SQLite worker.
*/

function sendRequest(action, data = {}) {
  return new Promise((resolve, reject) => {
    const requestId = ++requestCounter;

    pendingRequests.set(requestId, resolve);

    try {
      sqliteWorker.postMessage({
        action,
        data,
        requestId,
      });
    } catch (error) {
      pendingRequests.delete(requestId);

      reject(error);
    }
  });
}

/*
  Initialize SQLite.
*/

async function initSQLite() {
  try {
    const result = await sendRequest("init");

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log("✅ SQLite initialized");

    return true;
  } catch (error) {
    console.error("❌ SQLite initialization failed:", error);

    return false;
  }
}

/*
  Save game result.

  This function receives all the
  metrics collected by Memory Trail.
*/

async function saveGameResult({
  userId = "prototype-user-001",

  gameName,

  level = 1,

  difficulty = "easy",

  totalNumbers = 0,

  score = 0,

  mistakes = 0,

  timeTaken = 0,

  reactionTimes = [],

  reactionTimeStdDev = 0,

  errorLog = [],

  hesitationEvents = [],

  completed = false,
}) {
  if (!gameName) {
    console.error("❌ Game name is required.");

    return false;
  }

  /*
    Create a unique ID.

    The same sync_id is used by
    SQLite and later cloud sync.
  */

  const data = {
    sync_id: crypto.randomUUID(),

    user_id: userId,

    game_name: gameName,

    level: Number(level),

    difficulty: difficulty,

    total_numbers: Number(totalNumbers),

    score: Number(score),

    mistakes: Number(mistakes),

    time_taken: Number(timeTaken),

    /*
      Arrays/objects are stored as JSON
      strings inside SQLite.
    */

    reaction_times: JSON.stringify(reactionTimes),

    reaction_time_std_dev: Number(reactionTimeStdDev),

    error_log: JSON.stringify(errorLog),

    hesitation_events: JSON.stringify(hesitationEvents),

    completed: completed ? 1 : 0,

    completed_at: new Date().toISOString(),
  };

  try {
    const result = await sendRequest("saveResult", data);

    if (!result.success) {
      console.error("❌ Could not save game result:", result.error);

      return false;
    }

    console.log("✅ Game result saved to SQLite:", data);

    return true;
  } catch (error) {
    console.error("❌ SQLite save error:", error);

    return false;
  }
}

/*
  Get unsynchronized results.
*/

async function getUnsyncedResults() {
  try {
    const result = await sendRequest("getUnsynced");

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.results;
  } catch (error) {
    console.error("❌ Could not get unsynced results:", error);

    return [];
  }
}

/*
  Mark result as synchronized.
*/

async function markResultAsSynced(syncId) {
  if (!syncId) {
    throw new Error("sync_id is required.");
  }

  const result = await sendRequest("markSynced", {
    sync_id: syncId,
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  return true;
}

/*
  Get all game results.
*/

async function getAllGameResults() {
  const result = await sendRequest("getAll");

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.results;
}

/*
  Make functions available
  to the game.
*/

window.initSQLite = initSQLite;

window.saveGameResult = saveGameResult;

window.getUnsyncedResults = getUnsyncedResults;

window.markResultAsSynced = markResultAsSynced;

window.getAllGameResults = getAllGameResults;

console.log("✅ Offline SQLite helper loaded.");
