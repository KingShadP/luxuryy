const path = require('path');
const fs = require('fs');

let sqlite3;
let sqliteLoadError;
let sqliteCore;
let sqliteCoreLoadError;
let databaseInitError;
let databaseMode;

try {
  sqlite3 = require('sqlite3');
} catch (error) {
  sqliteLoadError = error;
}

try {
  sqliteCore = require('node:sqlite');
} catch (error) {
  sqliteCoreLoadError = error;
}

const dbPath = path.resolve(process.cwd(), process.env.DB_PATH || './data/residence.db');
let db;

try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  if (!sqliteLoadError) {
    db = new sqlite3.Database(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    databaseMode = 'sqlite3';
  } else if (!sqliteCoreLoadError) {
    db = new sqliteCore.DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    databaseMode = 'node:sqlite';
  }
} catch (error) {
  databaseInitError = error;
}

function getDatabaseOrThrow() {
  if (databaseInitError) {
    const error = new Error(`SQLite database initialization failed: ${databaseInitError.message}`);
    error.cause = databaseInitError;
    throw error;
  }

  if (!db) {
    const details = [sqliteLoadError, sqliteCoreLoadError]
      .filter(Boolean)
      .map((error) => error.message)
      .join('; ');
    const message = `SQLite drivers failed to load in this runtime: ${details || 'unknown error'}`;
    const error = new Error(message);
    error.cause = sqliteLoadError || sqliteCoreLoadError;
    throw error;
  }

  return db;
}

function run(sql, params = []) {
  if (databaseMode === 'node:sqlite') {
    return Promise.resolve().then(() => {
      const database = getDatabaseOrThrow();
      const statement = database.prepare(sql);
      const result = statement.run(...params);
      return {
        id: Number(result.lastInsertRowid || 0),
        changes: Number(result.changes || 0),
      };
    });
  }

  return new Promise((resolve, reject) => {
    const database = getDatabaseOrThrow();
    database.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  if (databaseMode === 'node:sqlite') {
    return Promise.resolve().then(() => {
      const database = getDatabaseOrThrow();
      const statement = database.prepare(sql);
      return statement.get(...params);
    });
  }

  return new Promise((resolve, reject) => {
    const database = getDatabaseOrThrow();
    database.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  if (databaseMode === 'node:sqlite') {
    return Promise.resolve().then(() => {
      const database = getDatabaseOrThrow();
      const statement = database.prepare(sql);
      return statement.all(...params);
    });
  }

  return new Promise((resolve, reject) => {
    const database = getDatabaseOrThrow();
    database.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      high_thinking_default INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      high_thinking INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS acquisition_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      interests TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run('CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at)');
  await run('CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON acquisition_submissions(created_at DESC)');
}

module.exports = {
  run,
  get,
  all,
  initializeDatabase,
};
