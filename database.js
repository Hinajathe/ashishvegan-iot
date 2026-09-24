const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'iot_database.sqlite');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log(`Connected to SQLite database at: ${DB_PATH}`);
  }
});

// Helper function to format timestamp in Asia/Kolkata (+05:30)
function formatKolkataTime(isoString) {
  const date = isoString ? new Date(isoString) : new Date();
  
  // Format options for Asia/Kolkata
  const timeFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const dateFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return {
    time: timeFormatter.format(date),
    date: dateFormatter.format(date),
    iso: date.toISOString()
  };
}

// Promisified DB helpers
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Initialize tables
async function initDatabase() {
  db.serialize(() => {
    // Enable WAL mode for better concurrency
    db.run('PRAGMA journal_mode = WAL;');

    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sensor records table
    db.run(`
      CREATE TABLE IF NOT EXISTS sensor_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temperature REAL NOT NULL,
        humidity REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Device config table (LED state, LCD text)
    db.run(`
      CREATE TABLE IF NOT EXISTS device_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, async () => {
      // Seed default configurations if missing
      try {
        const led = await dbGet("SELECT value FROM device_config WHERE key = 'led_state'");
        if (!led) {
          await dbRun("INSERT INTO device_config (key, value) VALUES ('led_state', '0')");
        }
        const lcd1 = await dbGet("SELECT value FROM device_config WHERE key = 'lcd_row1'");
        if (!lcd1) {
          await dbRun("INSERT INTO device_config (key, value) VALUES ('lcd_row1', 'Aaditya Kayande')");
        }
        const lcd2 = await dbGet("SELECT value FROM device_config WHERE key = 'lcd_row2'");
        if (!lcd2) {
          await dbRun("INSERT INTO device_config (key, value) VALUES ('lcd_row2', 'System Ready')");
        }
      } catch (e) {
        console.error('Error seeding device_config:', e);
      }
    });
  });
}

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  initDatabase,
  formatKolkataTime
};
