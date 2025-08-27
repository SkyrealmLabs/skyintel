const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const mysql = require('mysql2');

const host = "127.0.0.1";
const port = 8080;

// Serve static files (your HTML, CSS, JavaScript)
app.use(express.static(path.join(__dirname, 'www')));

// Add JSON middleware
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Default route (optional)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'www', 'index.html'));
});

function createDatabasePool() {
  db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'skyintel',
    port: 3307,
    waitForConnections: true,
    connectionLimit: 10, // Adjust as needed
    queueLimit: 0
  });

  db.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to MySQL:', err);
      setTimeout(createDatabasePool, 2000); // Retry if connection fails
    } else {
      console.log('Connected to MySQL Database');
      connection.release(); // Release the initial connection
    }
  });

  db.on('error', err => {
    console.error('Database error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('Reconnecting to MySQL...');
      createDatabasePool();
    } else {
      throw err;
    }
  });
}

createDatabasePool();

let joystickData = {}; // Store joystick data globally

// Endpoint to receive gamepad data
app.post('/gamepad-data', (req, res) => {
  joystickData = req.body;
  console.log('Received gamepad data:', joystickData);
  res.status(200).send('Gamepad data received');
});

// Endpoint to receive gamepad data
app.get('/gamepad-status', (req, res) => {
  res.status(200).send(joystickData);
});

// API: Save new drone position
app.post('/api/drone/:id/position', (req, res) => {
    const droneId = req.params.id;
    const { lat, lng } = req.body;

    if (!lat || !lng) {
        return res.status(400).json({ error: 'Missing coordinates.' });
    }

    const query = 'INSERT INTO drone_paths (drone_id, latitude, longitude) VALUES (?, ?, ?)';
    db.query(query, [droneId, lat, lng], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ message: 'Position saved.' });
    });
});

// API: Get historical path
app.get('/api/drone/:id/path', (req, res) => {
    const droneId = req.params.id;

    const query = 'SELECT latitude AS lat, longitude AS lng FROM drone_paths WHERE drone_id = ? ORDER BY timestamp';
    db.query(query, [droneId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json(results);
    });
});

// API: Clear path
app.delete('/api/drone/:id/path', (req, res) => {
    const droneId = req.params.id;

    const query = 'DELETE FROM drone_paths WHERE drone_id = ?';
    db.query(query, [droneId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ message: 'Path cleared.' });
    });
});

// Start Server
http.listen(port, host, () => {
  console.log(`WebUI server listening at http://${host}:${port}`);
});