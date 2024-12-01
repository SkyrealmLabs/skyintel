const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);

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

http.listen(port, host, () => {
  console.log(`WebUI server listening at http://${host}:${port}`);
});
