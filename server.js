require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { dbRun, dbGet, dbAll, initDatabase, formatKolkataTime } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ashishvegan_secret_super_key_2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB schema
initDatabase();

// Auth Middleware (optional for hardware endpoints, mandatory for dashboard actions if protected)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired session' });
    }
    req.user = user;
    next();
  });
}

// -------------------------------------------------------------
// AUTHENTICATION ROUTES
// -------------------------------------------------------------

// Registration (Name, Email, Password)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists
    const existing = await dbGet('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbRun(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name.trim(), normalizedEmail, hashedPassword]
    );

    const token = jwt.sign(
      { id: result.lastID, email: normalizedEmail, name: name.trim() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account registered successfully!',
      token,
      user: { id: result.lastID, name: name.trim(), email: normalizedEmail }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// Login (Email, Password)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Logged in successfully!',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Get Current User Profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// -------------------------------------------------------------
// HARDWARE & SENSOR DATA ROUTES (TAB 1)
// -------------------------------------------------------------

// POST /api/sensor-data
// Receives data from ESP8266 or dashboard simulator every 10 seconds
app.post('/api/sensor-data', async (req, res) => {
  try {
    let { temperature, humidity } = req.body;

    // Handle string inputs from query or raw forms
    if (temperature === undefined && req.query.temperature) temperature = req.query.temperature;
    if (humidity === undefined && req.query.humidity) humidity = req.query.humidity;

    const tempNum = parseFloat(temperature);
    const humNum = parseFloat(humidity);

    if (isNaN(tempNum) || isNaN(humNum)) {
      return res.status(400).json({ success: false, message: 'Invalid temperature or humidity value.' });
    }

    // Insert into SQLite
    const nowUtc = new Date().toISOString();
    const result = await dbRun(
      'INSERT INTO sensor_records (temperature, humidity, created_at) VALUES (?, ?, ?)',
      [tempNum, humNum, nowUtc]
    );

    const kolkata = formatKolkataTime(nowUtc);

    res.status(201).json({
      success: true,
      message: 'Sensor data saved successfully',
      id: result.lastID,
      data: {
        temperature: tempNum,
        humidity: humNum,
        time: kolkata.time,
        date: kolkata.date
      }
    });
  } catch (error) {
    console.error('Error saving sensor data:', error);
    res.status(500).json({ success: false, message: 'Failed to record sensor reading.' });
  }
});

// GET /api/sensor-data/latest
// Fetch latest single reading for real-time Gauge/Seek bar display
app.get('/api/sensor-data/latest', async (req, res) => {
  try {
    const row = await dbGet('SELECT * FROM sensor_records ORDER BY id DESC LIMIT 1');
    if (!row) {
      return res.json({
        success: true,
        hasData: false,
        data: {
          temperature: 0,
          humidity: 0,
          time: '--:--',
          date: '--/--/----'
        }
      });
    }

    const kolkata = formatKolkataTime(row.created_at);
    res.json({
      success: true,
      hasData: true,
      data: {
        id: row.id,
        temperature: row.temperature,
        humidity: row.humidity,
        time: kolkata.time,
        date: kolkata.date,
        raw_created_at: row.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve latest reading.' });
  }
});

// GET /api/sensor-data
// Paginated records list (Show latest records first, 20 records at a time)
app.get('/api/sensor-data', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const totalCountRow = await dbGet('SELECT COUNT(*) as count FROM sensor_records');
    const totalRecords = totalCountRow ? totalCountRow.count : 0;
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    // Fetch latest records first (ORDER BY id DESC)
    const rows = await dbAll(
      'SELECT id, temperature, humidity, created_at FROM sensor_records ORDER BY id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const formattedRecords = rows.map((r, index) => {
      const kolkata = formatKolkataTime(r.created_at);
      return {
        id: r.id,
        serialNumber: totalRecords - offset - index, // Intuitive descending record number
        temperature: r.temperature,
        humidity: r.humidity,
        time: kolkata.time,
        date: kolkata.date,
        created_at: r.created_at
      };
    });

    res.json({
      success: true,
      records: formattedRecords,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve records.' });
  }
});

// DELETE /api/sensor-data/:id
// Delete a specific record
app.delete('/api/sensor-data/:id', async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    if (!recordId) {
      return res.status(400).json({ success: false, message: 'Invalid record ID.' });
    }

    const result = await dbRun('DELETE FROM sensor_records WHERE id = ?', [recordId]);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }

    res.json({ success: true, message: `Record #${recordId} deleted successfully.` });
  } catch (error) {
    console.error('Error deleting record:', error);
    res.status(500).json({ success: false, message: 'Failed to delete record.' });
  }
});

// GET /api/sensor-data/history
// Returns last 30 records in chronological order for Chart.js
app.get('/api/sensor-data/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const rows = await dbAll(
      'SELECT id, temperature, humidity, created_at FROM sensor_records ORDER BY id DESC LIMIT ?',
      [limit]
    );

    // Reverse to display chronologically from left to right on graph
    const chronoSorted = rows.reverse().map(r => {
      const kolkata = formatKolkataTime(r.created_at);
      return {
        id: r.id,
        temperature: r.temperature,
        humidity: r.humidity,
        time: kolkata.time,
        date: kolkata.date,
        timestamp: r.created_at
      };
    });

    res.json({ success: true, history: chronoSorted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch sensor history.' });
  }
});

// -------------------------------------------------------------
// HARDWARE / DEVICE CONTROL (TAB 2: SMART LCD, TAB 3: LED)
// -------------------------------------------------------------

// GET /api/device/state
// Polled by ESP8266 to retrieve current LED state and LCD rows
app.get('/api/device/state', async (req, res) => {
  try {
    const ledRow = await dbGet("SELECT value FROM device_config WHERE key = 'led_state'");
    const lcd1Row = await dbGet("SELECT value FROM device_config WHERE key = 'lcd_row1'");
    const lcd2Row = await dbGet("SELECT value FROM device_config WHERE key = 'lcd_row2'");

    res.json({
      success: true,
      led: ledRow ? parseInt(ledRow.value) || 0 : 0,
      lcd_row1: lcd1Row ? lcd1Row.value : 'Aaditya Kayande',
      lcd_row2: lcd2Row ? lcd2Row.value : 'System Ready'
    });
  } catch (error) {
    console.error('Error fetching device state:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch device state' });
  }
});

// POST /api/device/led
// Toggle LED ON/OFF from Tab 3
app.post('/api/device/led', async (req, res) => {
  try {
    const { state } = req.body;
    const newState = (state === true || state === 1 || state === '1' || state === 'true' || state === 'on') ? '1' : '0';

    await dbRun(
      "INSERT INTO device_config (key, value, updated_at) VALUES ('led_state', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
      [newState]
    );

    res.json({
      success: true,
      led: parseInt(newState),
      message: `LED switched ${newState === '1' ? 'ON' : 'OFF'}`
    });
  } catch (error) {
    console.error('Error setting LED state:', error);
    res.status(500).json({ success: false, message: 'Failed to update LED state.' });
  }
});

// POST /api/device/lcd
// Update LCD rows from Tab 2 (16 chars max per row)
app.post('/api/device/lcd', async (req, res) => {
  try {
    let { row1, row2 } = req.body;

    // Sanitize & enforce 16 characters max
    row1 = (row1 !== undefined && row1 !== null) ? String(row1).substring(0, 16) : '';
    row2 = (row2 !== undefined && row2 !== null) ? String(row2).substring(0, 16) : '';

    await dbRun(
      "INSERT INTO device_config (key, value, updated_at) VALUES ('lcd_row1', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
      [row1]
    );

    await dbRun(
      "INSERT INTO device_config (key, value, updated_at) VALUES ('lcd_row2', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
      [row2]
    );

    res.json({
      success: true,
      lcd_row1: row1,
      lcd_row2: row2,
      message: 'Smart LCD message updated successfully!'
    });
  } catch (error) {
    console.error('Error updating LCD content:', error);
    res.status(500).json({ success: false, message: 'Failed to update LCD content.' });
  }
});

// POST /api/device/simulate
// Convenience simulator endpoint so user can test live graphs and gauges right in the browser
app.post('/api/device/simulate', async (req, res) => {
  try {
    // Generate realistic fluctuating temperature (25 - 34 C) and humidity (45 - 80 %)
    const temp = parseFloat((25 + Math.random() * 9).toFixed(1));
    const hum = parseFloat((50 + Math.random() * 25).toFixed(1));
    const nowUtc = new Date().toISOString();

    const result = await dbRun(
      'INSERT INTO sensor_records (temperature, humidity, created_at) VALUES (?, ?, ?)',
      [temp, hum, nowUtc]
    );

    const kolkata = formatKolkataTime(nowUtc);

    res.json({
      success: true,
      simulated: true,
      id: result.lastID,
      data: {
        temperature: temp,
        humidity: hum,
        time: kolkata.time,
        date: kolkata.date
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Simulation error' });
  }
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  Aaditya Kayande IoT Server running on port ${PORT}`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Timezone: Asia/Kolkata (+05:30)`);
  console.log(`=======================================================`);
});
