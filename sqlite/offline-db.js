/*
  ==========================================
  OFFLINE SQLITE DATABASE HELPER
  ==========================================
*/

const sqliteWorker = new Worker(
  new URL("./sqlite-worker.js", import.meta.url),
  {
    type: "module",
  },
);

/*
  ==========================================
  PENDING REQUESTS
  ==========================================
*/

const pendingRequests = new Map();

let requestCounter = 0;

/*
  ==========================================
  WORKER RESPONSE HANDLER
  ==========================================
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
  ==========================================
  WORKER ERROR
  ==========================================
*/

sqliteWorker.onerror = (error) => {
  console.error("SQLite Worker Error:", error);
};

/*
  ==========================================
  SEND REQUEST
  ==========================================
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
  ==========================================
  INITIALIZE SQLITE
  ==========================================
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
  ==========================================
  SAVE GAME RESULT
  ==========================================
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

    console.log("✅ Count Next result saved:", data);

    return true;
  } catch (error) {
    console.error("❌ SQLite save error:", error);

    return false;
  }
}

/*
  ==========================================
  GET RECENT SESSIONS
  ==========================================
*/

async function getRecentSessions(
  userId = "prototype-user-001",

  gameName = "Count Next",

  limit = 3,
) {
  try {
    const result = await sendRequest("getRecentSessions", {
      user_id: userId,

      game_name: gameName,

      limit: Number(limit),
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.results || [];
  } catch (error) {
    console.error("❌ Could not get recent sessions:", error);

    return [];
  }
}

/*
  ==========================================
  GET UNSYNCED RESULTS
  ==========================================
*/

async function getUnsyncedResults() {
  try {
    const result = await sendRequest("getUnsynced");

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.results || [];
  } catch (error) {
    console.error("❌ Could not get unsynced results:", error);

    return [];
  }
}

/*
  ==========================================
  MARK RESULT AS SYNCED
  ==========================================
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
  ==========================================
  GET ALL RESULTS
  ==========================================
*/

async function getAllGameResults() {
  const result = await sendRequest("getAll");

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.results || [];
}

/*
  ==========================================
  MAKE FUNCTIONS AVAILABLE
  ==========================================
*/

window.initSQLite = initSQLite;

window.saveGameResult = saveGameResult;

window.getRecentSessions = getRecentSessions;

window.getUnsyncedResults = getUnsyncedResults;

window.markResultAsSynced = markResultAsSynced;

window.getAllGameResults = getAllGameResults;

console.log("✅ Offline SQLite helper loaded.");
