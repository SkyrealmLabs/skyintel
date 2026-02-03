const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const CryptoJS = require('crypto-js');
const fs = require('fs');
const { spawn } = require('child_process'); // Diperlukan untuk menjalankan Python

const saltRounds = 10;
const host = "127.0.0.1";
const port = 8080;
const {
  JWT_SECRET,
  RECAPTCHA_SECRET,
  SECRET_KEY
} = require('./constant');
const UPLOAD_DIRECTORY = path.join(__dirname, 'uploads');
const LIB_UPLOAD_DIR = path.join(__dirname, 'uploads/library');

// Serve static files (your HTML, CSS, JavaScript)
app.use(express.static(path.join(__dirname, 'www')));

// 🔥 PENTING: Add JSON middleware dengan had yang lebih tinggi (50mb) untuk Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Tambah ini sebagai langkah berjaga-jaga

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

function encryptId(id) {
  // AES encryption
  const ciphertext = CryptoJS.AES.encrypt(String(id), SECRET_KEY).toString();
  return ciphertext;
}

function decryptId(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
  const originalId = bytes.toString(CryptoJS.enc.Utf8);
  return originalId;
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure the upload directory exists
    if (!fs.existsSync(UPLOAD_DIRECTORY)) {
      fs.mkdirSync(UPLOAD_DIRECTORY, { recursive: true }); // Create the directory if it doesn't exist
    }

    cb(null, UPLOAD_DIRECTORY); // Save files to your specified path
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Get file extension
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`; // Generate unique file name
    cb(null, uniqueName); // Save file with unique name
  }
});

// Initialize multer with file filter for videos
// Initialize multer with file filter for videos
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Define allowed MIME types - ADD video/webm HERE
    const allowedMimeTypes = [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-ms-wmv",
      "video/x-matroska",
      "video/webm", // <--- CRITICAL: Allow webm from browser
    ];

    // Add webm to the extension regex
    const fileTypes = /mp4|mov|avi|wmv|mkv|quicktime|webm/;

    const mimetype = allowedMimeTypes.includes(file.mimetype);
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      cb(null, true);
    } else {
      // Use a custom error message so you know why it failed
      cb(new Error(`File type ${file.mimetype} is not allowed!`), false);
    }
  },
});

// Configure storage for Library Files
const libraryFileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Pastikan folder ini wujud atau auto-create
    const dir = path.join(__dirname, 'uploads/library_files');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Nama unik: file-timestamp-random.ext
    const ext = path.extname(file.originalname);
    const uniqueName = `file-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});

const uploadLibraryFile = multer({
  storage: libraryFileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  fileFilter: function (req, file, cb) {
    const fileTypes = /jpeg|jpg|png|pdf/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG, PNG, and PDF formats are allowed!"));
  }
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

// API: Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    // Find the user in the database
    const user = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM user WHERE email = ?', [email], (err, result) => {
        if (err) return reject(err);
        resolve(result.length > 0 ? result[0] : null);
      });
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ✅ Allow only Admin (1), Super Admin (2), and Role (4)
    // if (![1, 2, 4].includes(user.user_role_id)) {
    //   return res.status(403).json({ message: "Access denied. Only Admin and Super Admin can log in." });
    // }

    // ✅ Update isLogin to 1 and increment login_count
    await new Promise((resolve, reject) => {
      db.query(
        'UPDATE user SET isLogin = 1, login_count = login_count + 1 WHERE id = ?',
        [user.id],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.user_role_id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneno: user.phoneno,
        role: user.user_role_id,
        isLogin: 1,
        login_count: user.login_count + 1, // incremented value
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error logging in" });
  }
});

// API: SkyLanderLogin
app.post('/api/skylander/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    // Find the user in the database
    const user = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM user WHERE email = ?', [email], (err, result) => {
        if (err) return reject(err);
        resolve(result.length > 0 ? result[0] : null);
      });
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ✅ Update isLogin to 1 and increment login_count
    await new Promise((resolve, reject) => {
      db.query(
        'UPDATE user SET isLogin = 1, login_count = login_count + 1 WHERE id = ?',
        [user.id],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.user_role_id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneno: user.phoneno,
        role: user.user_role_id,
        isLogin: 1,
        login_count: user.login_count + 1, // incremented value
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error logging in" });
  }
});

// Logout API
app.put("/api/logout", (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const query = `UPDATE user SET isLogin = 0, updated_at = ? WHERE id = ?`;

  const timestamp = getCurrentTimestamp();

  db.query(query, [timestamp, id], (err, result) => {
    if (err) {
      console.error("❌ Error updating user:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User successfully logout" });
  });
});

// API: Get User List
app.get('/api/users', async (req, res) => {
  try {
    const users = await new Promise((resolve, reject) => {
      db.query(
        `SELECT u.id, u.name, u.email, u.phoneno, r.id AS role_id, r.name AS role_name, u.isDeactive, u.isDeleted
          FROM user u
          INNER JOIN user_role r ON u.user_role_id = r.id
          WHERE u.user_role_id != 3 AND u.isDeleted = 0`,
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    res.status(200).json({
      message: "User list fetched successfully",
      users
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching user list" });
  }
});

// API: Get User By ID
app.post('/api/getUserByID', async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await new Promise((resolve, reject) => {
      db.query(
        ` 
          SELECT u.id, u.user_role_id, r.name AS role_name, u.name, u.first_name, u.last_name, u.email, u.phoneno, u.department, u.designation, u.gender, u.birthday_date
          FROM user u
          INNER JOIN user_role r ON u.user_role_id = r.id
          WHERE u.id = ? AND u.isDeleted = 0 AND u.isDeactive = 0
        `,
        [id],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User fetched successfully",
      user: user[0] // Return a single user object
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching user" });
  }
});

// API: Get User By Email
app.post('/api/getUserByEmail', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await new Promise((resolve, reject) => {
      db.query(
        ` 
          SELECT * FROM user WHERE email = ? AND isDeleted = 0 AND isDeactive = 0
        `,
        [email],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User fetched successfully",
      user: user[0] // Return a single user object
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching user" });
  }
});

// API: Encrypt ID
app.post('/api/encrypt', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id is required' });
  const encrypted = encryptId(id);
  res.json({ encrypted });
});

// API: Decrypt ID
app.post('/api/decrypt', (req, res) => {
  const { encrypted } = req.body;
  if (!encrypted) return res.status(400).json({ error: 'encrypted value is required' });
  try {
    const id = decryptId(encrypted);
    res.json({ id });
  } catch (err) {
    res.status(400).json({ error: 'Invalid encrypted value' });
  }
});

// API: Change Password
app.put('/api/change-password', async (req, res) => {
  const { userId, currentPassword, newPassword, confirmPassword } = req.body;

  // 1. Validate input
  if (!userId || !currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // 2. Check new password & confirm password
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "New password and confirm password do not match" });
  }

  try {
    // 3. Find the user by ID
    const user = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM user WHERE id = ?', [userId], (err, result) => {
        if (err) return reject(err);
        resolve(result.length > 0 ? result[0] : null);
      });
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 4. Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // 5. Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 6. Update password in the database
    await new Promise((resolve, reject) => {
      db.query('UPDATE user SET password = ? WHERE id = ?', [hashedPassword, userId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    res.status(200).json({ message: "Password changed successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error changing password" });
  }
});

// API: Change First Time Password
app.put('/api/change-password/firsttime', async (req, res) => {
  const { userId, currentPassword, newPassword, confirmPassword } = req.body;

  // 1. Validate input
  if (!userId || !currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // 2. Check new password & confirm password
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "New password and confirm password do not match" });
  }

  try {
    // 3. Find the user by ID
    const user = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM user WHERE id = ?', [userId], (err, result) => {
        if (err) return reject(err);
        resolve(result.length > 0 ? result[0] : null);
      });
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 4. Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // 5. Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 6. Update password in the database
    await new Promise((resolve, reject) => {
      db.query('UPDATE user SET password = ?, login_count = login_count + 1 WHERE id = ?', [hashedPassword, userId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    res.status(200).json({ message: "Password changed successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error changing password" });
  }
});

// API: Reset Password
app.put('/api/reset-password', async (req, res) => {
  const { userId, newPassword, confirmPassword } = req.body;

  if (!userId || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "New password and confirm password do not match" });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    await new Promise((resolve, reject) => {
      db.query('UPDATE user SET password = ? WHERE id = ?', [hashedPassword, userId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    res.status(200).json({ message: "Password reset successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error reset password" });
  }
});

app.post('/api/user/add', async (req, res) => {
  const { user_name, role, first_name, last_name, department, designation, gender, birthday, email, phoneno } = req.body;

  // Validate required fields
  if (!user_name || !role || !email || !phoneno) {
    return res.status(400).json({ error: 'User name, role, email, and phone number are required' });
  }

  try {
    // Step 1: Check if username or email already exists
    const existingUser = await new Promise((resolve, reject) => {
      const checkQuery = `SELECT * FROM user WHERE name = ? OR email = ?`;
      db.query(checkQuery, [user_name, email], (err, result) => {
        if (err) return reject(err);
        resolve(result.length > 0 ? result[0] : null);
      });
    });

    if (existingUser) {
      return res.status(400).json({
        error: existingUser.name === user_name
          ? 'Username already exists'
          : 'Email already exists'
      });
    }

    // Step 2: Generate a random 8-character password
    const plainPassword = Math.random().toString(36).slice(-8);

    // Step 3: Encrypt the password using bcrypt
    const encryptedPassword = await bcrypt.hash(plainPassword, saltRounds);

    // Step 4: Insert new user
    const insertQuery = `
      INSERT INTO user (
        user_role_id, name, first_name, last_name, password, email, phoneno,
        department, designation, gender, birthday_date, isDeleted, isDeactive, isLogin, login_count, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const timestamp = getCurrentTimestamp();

    db.query(
      insertQuery,
      [role, user_name, first_name, last_name, encryptedPassword, email, phoneno, department, designation, gender, birthday, 0, 0, 0, 0, timestamp, timestamp],
      (err, result) => {
        if (err) {
          console.error("Error adding user:", err);
          return res.status(500).json({ error: 'Database error' });
        }

        res.status(201).json({
          message: 'User added successfully',
          user_id: result.insertId,
          data: {
            username: user_name,
            firstname: first_name,
            lastname: last_name,
            email: email,
            password: plainPassword,
          }
        });
      }
    );


  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/user/update', (req, res) => {
  const { id, first_name, last_name, department, designation, gender, birthday, email, phoneno } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const query = `
    UPDATE user
    SET first_name = ?, last_name = ?, email = ?, phoneno = ?, department = ?, designation = ?, gender = ?, birthday_date = ?, updated_at = ?
    WHERE id = ?
  `;

  const timestamp = getCurrentTimestamp();

  db.query(
    query,
    [first_name, last_name, email, phoneno, department, designation, gender, birthday, timestamp, id],
    (err, result) => {
      if (err) {
        console.error("Error updating user:", err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User updated successfully' });
    }
  );
});

// Activate user API
app.put("/api/user/activate", (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const query = `UPDATE user SET isDeactive = 0, updated_at = ? WHERE id = ?`;

  const timestamp = getCurrentTimestamp();

  db.query(query, [id, timestamp], (err, result) => {
    if (err) {
      console.error("❌ Error updating user:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User successfully activate" });
  });
});

// Deactivate user API
app.put("/api/user/deactivate", (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const query = `UPDATE user SET isDeactive = 1, updated_at = ? WHERE id = ?`;

  const timestamp = getCurrentTimestamp();

  db.query(query, [timestamp, id], (err, result) => {
    if (err) {
      console.error("❌ Error updating user:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User successfully deactivate" });
  });
});

// Soft delete user API
app.delete("/api/user/delete", (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const query = `UPDATE user SET isDeleted = 1, isDeactive = 1, updated_at = ? WHERE id = ?`;

  const timestamp = getCurrentTimestamp();

  db.query(query, [timestamp, id], (err, result) => {
    if (err) {
      console.error("❌ Error updating user:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User successfully deleted" });
  });
});

// Add Location API
app.post('/api/location/add', upload.single('media'), (req, res) => {
  try {
    const { userID, address, coordinate } = req.body;

    // 1. Safety check for file
    if (!req.file) {
      return res.status(400).json({ message: "No video file provided or file type not allowed." });
    }

    // 2. Safety check for coordinate parsing
    let parsedCoordinate;
    try {
      parsedCoordinate = typeof coordinate === 'string' ? JSON.parse(coordinate) : coordinate;
    } catch (e) {
      return res.status(400).json({ message: "Invalid coordinate format" });
    }

    const lat = parseFloat(parsedCoordinate.latitude).toFixed(6);
    const lng = parseFloat(parsedCoordinate.longitude).toFixed(6);
    const timestamp = getCurrentTimestamp();
    const mediaFileName = path.basename(req.file.path);

    db.query(
      "INSERT INTO location (userid, locationStatusId, locationAddress, aruco_id, latitude, longitude, mediaPath, mediaFileName, isDeleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [userID, 1, address, null, lat, lng, req.file.path, mediaFileName, false, timestamp, timestamp],
      (err, result) => {
        if (err) {
          console.error("DB Error:", err);
          return res.status(500).json({ message: "Database error" });
        }
        res.status(201).json({ message: "Location added successfully" });
      }
    );
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get Location API
app.get('/api/location/get', (req, res) => {
  const query = `
    SELECT l.id, l.userid, l.aruco_id, u.name, u.email, ls.name AS status, l.locationAddress, l.latitude, l.longitude, l.mediaPath, l.mediaFileName
    FROM location l
    INNER JOIN location_status ls ON l.locationStatusId = ls.id
    INNER JOIN user u ON l.userid = u.id
    WHERE l.isDeleted = false AND u.isDeleted = false
    ORDER BY id DESC;
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Database error: ", err);
      return res.status(500).json({ message: "Database error" });
    }

    // Send back the results as a JSON response
    return res.status(200).json({
      message: "Locations fetched successfully",
      data: results
    });
  });
});

// Get Location By User ID API
app.post('/api/location/getLocationByUserId', (req, res) => {
  const userID = req.body.userID; // Retrieve userID from the request body

  // Check if userID is provided
  if (!userID) {
    return res.status(400).json({ message: "User ID is required" });
  }

  // Query to get non-deleted locations for the specified user
  const query = `
    SELECT l.id, l.userid, l.aruco_id, ls.name AS status, l.locationAddress, l.latitude, l.longitude, l.mediaPath, l.mediaFileName
    FROM location l
    INNER JOIN location_status ls ON l.locationStatusId = ls.id
    WHERE l.isDeleted = false AND l.userid = ?
    ORDER BY id DESC`;

  db.query(query, [userID], (err, results) => {
    if (err) {
      console.error("Database error: ", err);
      return res.status(500).json({ message: "Database error" });
    }

    // Check if the user has any locations
    if (results.length === 0) {
      return res.status(404).json({ message: "No locations found" });
    }

    // Send back the results as a JSON response
    return res.status(200).json({
      message: "Locations fetched successfully",
      totalLocations: results.length,
      data: results
    });
  });
});

// Get Location Details By ID API
app.post('/api/location/getLocationDetailsById', (req, res) => {
  const ID = req.body.ID;

  // Check if ID is provided
  if (!ID) {
    return res.status(400).json({ message: "ID is required" });
  }

  const query = `
    SELECT l.id, l.userid, l.aruco_id, u.name, u.email, ls.name AS status, l.locationAddress, l.latitude, l.longitude, l.mediaPath, l.mediaFileName
    FROM location l
    INNER JOIN location_status ls ON l.locationStatusId = ls.id
    INNER JOIN user u ON l.userid = u.id
    WHERE l.isDeleted = false AND u.isDeleted = false AND l.id = ?
  `;

  db.query(query, [ID], (err, results) => {
    if (err) {
      console.error("Database error: ", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "No locations found" });
    }

    return res.status(200).json({
      message: "Location details fetched successfully", // Adjusted message for clarity
      totalLocations: results.length,
      data: results
    });
  });
});

// Enroll Location API (UPDATED to use NOW() for simplicity)
app.post('/api/location/review', (req, res) => {
  const { locationStatusId, aruco_id, id } = req.body;

  // SQL query to update the location status and set updated_at to the current timestamp
  const query = `
    UPDATE location
    SET locationStatusId = ?, aruco_id = ?, updated_at = NOW()
    WHERE id = ?;
  `;

  // Execute the query with the provided data
  // Note: aruco_id can be NULL if rejected
  db.query(query, [locationStatusId, aruco_id, id], (err, results) => {
    if (err) {
      console.error("Database error: ", err);
      return res.status(500).json({ message: "Database error" });
    }

    // Check if any rows were affected (meaning the update was successful)
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Location not found" });
    }

    // Send back a success message
    return res.status(200).json({
      message: "Location updated successfully",
      data: results
    });
  });
});

// Log Location Enrollment Review API
app.post('/api/location/enrollment/log', (req, res) => {
  const { userID, userName, locationID, action } = req.body;

  // Validate input
  if (!userID || !locationID || !action) {
    return res.status(400).json({ message: "User ID, Location ID, and Action are required" });
  }

  // Ensure action is either 'approve' or 'reject'
  const validActions = ['approved', 'rejected'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ message: "Invalid action. Allowed actions are 'approved' or 'rejected'" });
  }

  // Prepare the log directory and file paths
  const timestamp = new Date().toISOString();
  const logDate = timestamp.slice(0, 10); // Format as YYYY-MM-DD
  const logDir = path.join(__dirname, 'www', 'logs');
  const logFilePath = path.join(logDir, `review_${logDate}.txt`);

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Format the log entry
  const logEntry = `UserID: ${userID} | UserName: ${userName} | LocationID: ${locationID} | Action: ${action} | Timestamp: ${timestamp}\n`;

  // Append the log entry to the file
  fs.appendFile(logFilePath, logEntry, (err) => {
    if (err) {
      console.error("File logging error: ", err);
      return res.status(500).json({ message: "File logging error" });
    }

    // Respond with success message
    return res.status(201).json({
      message: "Enrollment review action logged successfully",
      log: {
        userID,
        locationID,
        action,
        timestamp
      }
    });
  });
});

// User Update Profile API
app.post('/api/user/updateProfile', (req, res) => {
  const { id, name, email, phone } = req.body; // Extract user data from the request body

  // Validate required fields
  if (!id || !name || !email || !phone) {
    return res.status(400).json({ message: "All fields (userID, name, email, phone) are required" });
  }

  // SQL query to update the user's profile
  const query = `
    UPDATE user
    SET name = ?, email = ?, phoneno = ?
    WHERE id = ?
  `;

  // Parameters for the query
  const params = [name, email, phone, id];

  // Execute the query
  db.query(query, params, (err, result) => {
    if (err) {
      console.error("Database error: ", err);
      return res.status(500).json({ message: "Database error" });
    }

    // Check if any rows were affected (updated)
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Respond with a success message
    return res.status(200).json({ message: "Profile updated successfully" });
  });
});

// Validate Location API
app.post('/api/location/validate', (req, res) => {
  const { pickup, dropoff } = req.body;

  if (
    !pickup || !dropoff || !pickup.latitude || !pickup.longitude || !dropoff.latitude || !dropoff.longitude
  ) {
    return res
      .status(400)
      .json({ error: 'Pickup and dropoff coordinates are required' });
  }

  const query = 'SELECT * FROM location';
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database query error' });
    }

    // Function to find the nearest location
    const findNearestLocation = (latitude, longitude) => {
      let nearestLocation = null;
      let minDistance = 1000; // set the minimum range for nearest location

      results.forEach((row) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          row.latitude,
          row.longitude
        );

        if (distance <= minDistance) {
          minDistance = distance;
          nearestLocation = row;
        }
      });

      return nearestLocation;
    };

    // Find nearest locations for pickup and dropoff
    const nearestPickup = findNearestLocation(
      pickup.latitude,
      pickup.longitude,
      pickup.aruco_id
    );

    const nearestDropoff = findNearestLocation(
      dropoff.latitude,
      dropoff.longitude,
      dropoff.aruco_id
    );

    if (nearestPickup && nearestDropoff) {
      res.status(200).json({
        message: 'Both pickup and dropoff locations are valid',
        nearestPickup,
        nearestDropoff,
      });
    } else {
      res.status(400).json({
        error: 'Invalid locations',
        details: {
          pickup: nearestPickup
            ? 'Valid'
            : 'No nearby location found for pickup',
          dropoff: nearestDropoff
            ? 'Valid'
            : 'No nearby location found for dropoff',
        },
      });
    }
  });
});

// API: Server-Side ArUco Scan (Menggunakan Python Subprocess)
app.post('/api/aruco/scan', (req, res) => {
  const { image } = req.body; // Base64 dataURL dari frontend

  if (!image) {
    return res.status(400).json({ success: false, error: 'No image provided.' });
  }

  // Tentukan jalan ke skrip Python
  const pythonScript = path.join(__dirname, 'aruco_scanner.py');

  // Cipta child process untuk menjalankan skrip Python
  // 🔥 PERHATIAN: Gunakan 'python' jika 'python3' tidak berfungsi pada sistem anda (lazim di Windows)
  const pythonProcess = spawn('python', [pythonScript]);
  // const pythonProcess = spawn('python3', [pythonScript]); // Alternatif untuk Linux/Mac

  let pythonOutput = '';
  let pythonError = '';

  // Menerima output dari Python (stdout)
  pythonProcess.stdout.on('data', (data) => {
    pythonOutput += data.toString();
  });

  // Menerima ralat dari Python (stderr)
  pythonProcess.stderr.on('data', (data) => {
    pythonError += data.toString();
  });

  // Apabila child process ditutup
  pythonProcess.on('close', (code) => {

    if (code !== 0) {
      console.error(`Python script exited with code ${code}. Stderr: ${pythonError}`);
      return res.status(500).json({ success: false, error: 'Python script error or failed to run.' });
    }

    try {
      // Parse JSON output dari Python
      const result = JSON.parse(pythonOutput);

      if (result.success && result.arucoId !== null) {
        res.json({ success: true, arucoId: result.arucoId });
      } else {
        console.log(`❌ ARUCO NOT FOUND. Reason: ${result.error || 'No IDs detected.'}`);
        res.json({ success: false, error: result.error || 'No ArUco Marker found.' });
      }
    } catch (e) {
      console.error("Error parsing Python output:", e);
      console.log("Raw Python Output:", pythonOutput);
      return res.status(500).json({ success: false, error: 'Failed to parse scanner output.' });
    }
  });

  // Menghantar data imej Base64 (JSON string) ke stdin Python
  const inputPayload = JSON.stringify({ image: image });
  pythonProcess.stdin.write(inputPayload);
  pythonProcess.stdin.end(); // Penting: Menutup input stream
});


// Add No Fly Zone API
app.post('/api/noFlyZone/add', (req, res) => {
  const { name, description, latitude, longitude, userID } = req.body;

  // Validate required fields
  if (!name || !description || latitude == null || longitude == null || !userID) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Get the current timestamp
  const timestamp = new Date();

  // Insert the new record
  const query = `
    INSERT INTO no_fly_zone 
    (name, description, latitude, longitude, user_id, isDeleted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [name, description, latitude, longitude, userID, 0, timestamp, timestamp],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      return res.status(201).json({
        message: "No-fly zone added successfully",
        insertId: result.insertId,
      });
    }
  );
});

// Get No Fly Zone By User ID API
app.post('/api/noFlyZone/getNoFlyZoneByUserId', (req, res) => {
  const { userID } = req.body;

  // Validate input
  if (!userID) {
    return res.status(400).json({ message: "User ID is required" });
  }

  // Query to get all non-deleted no-fly zones for this user
  const query = `
    SELECT id, name, description, latitude, longitude, user_id
    FROM no_fly_zone 
    WHERE user_id = ? AND isDeleted = 0
    ORDER BY id DESC;
  `;

  db.query(query, [userID], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    // Check if any records found
    if (results.length === 0) {
      return res.status(404).json({ message: "No no-fly zones found" });
    }

    // Return success response
    return res.status(200).json({
      message: "No-fly zones fetched successfully",
      totalLocations: results.length,
      data: results
    });
  });
});

// Serve Index.html From Subdirectories
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mov')) {
      res.setHeader('Content-Type', 'video/quicktime'); // For .mov files
    } else if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4'); // For .mp4 files
    }
  }
}));

// Add Library API
app.post('/api/library/add', (req, res) => {
  const { name, user_id } = req.body;

  // 1. Validate required fields
  if (!name || !user_id) {
    return res.status(400).json({ message: "Name and User ID are required" });
  }

  // 2. Prepare timestamp
  const timestamp = getCurrentTimestamp();

  // 3. SQL Query
  // Note: isDeleted is set to 0 (false) by default
  const query = `
    INSERT INTO library (name, user_id, isDeleted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [name, user_id, 0, timestamp, timestamp],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      // 4. Respond with success
      return res.status(201).json({
        message: "Library entry added successfully",
        libraryId: result.insertId
      });
    }
  );
});

// server.js

// API: Get Library Summary (Updated for Individual Status)
app.get('/api/library/summary', (req, res) => {
  const userId = req.query.user_id; // Terima user_id dari parameter

  const sql = `
              SELECT 
                l.id AS library_id,
                l.name AS document_name,
                u.name AS author,
                f.version AS last_version,
                f.updated_at AS last_update,
                COUNT(CASE WHEN ua.is_acknowledged = 1 THEN 1 END) AS acknowledged_count,
                COUNT(ua.id) AS total_assignments,
                CASE 
                  WHEN COUNT(ua.id) > 0 THEN ROUND((COUNT(CASE WHEN ua.is_acknowledged = 1 THEN 1 END) / COUNT(ua.id)) * 100)
                  ELSE 0 
                END AS ack_percentage,
                MAX(CASE WHEN ua.user_id = ? THEN ua.is_acknowledged ELSE 0 END) AS user_ack_status
              FROM library l
              LEFT JOIN user u ON l.user_id = u.id
              LEFT JOIN files f ON f.id = (
                SELECT id FROM files 
                WHERE library_id = l.id AND isDeleted = 0 
                ORDER BY created_at DESC LIMIT 1
              )
              LEFT JOIN user_acknowledgement ua ON f.id = ua.files_id
              WHERE l.isDeleted = 0
              GROUP BY l.id, f.id;
            `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ message: "Internal server error." });
    }
    res.json(results);
  });
});

// API: Upload Library File
app.post('/api/files/upload', uploadLibraryFile.single('file'), (req, res) => {

  // LANGKAH PENTING: Dapatkan connection tunggal dari pool
  db.getConnection((err, connection) => {
    if (err) {
      console.error("Database connection failed:", err);
      return res.status(500).json({ message: "Database connection error." });
    }

    try {
      const { library_id, version, upload_user_id } = req.body;

      // 1. Validasi Input
      if (!req.file) {
        connection.release(); // Jangan lupa release connection
        return res.status(400).json({ message: "Sila upload fail." });
      }
      if (!library_id || !version || !upload_user_id) {
        connection.release();
        return res.status(400).json({ message: "Maklumat user_id, library_id, atau version tidak lengkap." });
      }

      const fileName = req.file.filename;
      const filePath = req.file.path; // Simpan path penuh atau relative ikut preference
      const timestamp = new Date();   // Atau guna helper function anda

      // 2. Mulakan Transaction pada 'connection' (bukan 'db')
      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          console.error("Transaction Error:", err);
          return res.status(500).json({ message: "Transaction failed." });
        }

        // STEP A: Insert ke table 'files'
        // NOTA: Guna 'isDeleted' ikut screenshot MySQL Workbench anda
        const insertFileQuery = `
                    INSERT INTO files (file_name, user_id, library_id, file_path, version, isDeleted, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
                `;

        connection.query(insertFileQuery, [fileName, upload_user_id, library_id, filePath, version, timestamp, timestamp], (err, result) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error("Insert File Error:", err);
              res.status(500).json({ message: "Gagal menyimpan info fail." });
            });
          }

          const newFileId = result.insertId;

          // STEP B: Cari member yang aktif (untuk assign task acknowledge)
          // Anda boleh ubah WHERE clause ikut logic role sistem anda
          const getMembersQuery = `SELECT id FROM user WHERE user_role_id IN (1, 2, 4)`;

          connection.query(getMembersQuery, (err, members) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error("Get Members Error:", err);
                res.status(500).json({ message: "Gagal mendapatkan senarai ahli." });
              });
            }

            // Jika tiada member, commit sahaja fail tersebut
            if (members.length === 0) {
              connection.commit((err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ message: "Commit error." });
                  });
                }
                connection.release();
                return res.status(201).json({ message: "Fail diupload (Tiada ahli untuk di-assign)." });
              });
              return;
            }

            // STEP C: Insert ke 'user_acknowledgement'
            // NOTA: Guna 'files_id' ikut screenshot MySQL Workbench anda
            const acknowledgementData = members.map(m => [m.id, newFileId, 0, timestamp, timestamp]);

            const insertAckQuery = `
                            INSERT INTO user_acknowledgement (user_id, files_id, is_acknowledged, created_at, updated_at)
                            VALUES ?
                        `;

            connection.query(insertAckQuery, [acknowledgementData], (err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error("Insert Ack Error:", err);
                  res.status(500).json({ message: "Gagal create acknowledgement records." });
                });
              }

              // 3. SEMUA BERJAYA -> COMMIT
              connection.commit((err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error("Commit Error:", err);
                    res.status(500).json({ message: "Commit transaction failed." });
                  });
                }

                connection.release(); // Pulangkan connection ke pool
                res.status(201).json({
                  message: "Fail berjaya diupload dan task acknowledgement telah dicipta.",
                  fileId: newFileId
                });
              });
            });
          });
        });
      });

    } catch (error) {
      // Catch error lain (cth: coding error)
      if (connection) connection.release();
      console.error("Server Exception:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  });
});

// API: Get Library Folder Details by ID
app.get('/api/library/folder-details/:library_id', (req, res) => {
  const libraryId = req.params.library_id;

  const sql = `
        SELECT 
          f.version,
          u.name AS author,
          f.updated_at,
          TIMESTAMPDIFF(MINUTE, f.updated_at, NOW()) AS minutes_ago
        FROM files f
        LEFT JOIN user u ON f.user_id = u.id
        WHERE f.library_id = ? AND f.isDeleted = 0
        ORDER BY f.created_at DESC
        LIMIT 2; 
    `;

  db.query(sql, [libraryId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }

    // Default structure (kosong)
    const response = {
      Main: { version: '-', author: '-', date: '-', timeAgo: '-', hasFile: false },
      Archieve: { version: '-', author: '-', date: '-', timeAgo: '-', hasFile: false }
    };

    // LOGIK BARU:
    // Result[0] adalah fail paling latest -> Masuk ke Main
    if (results.length > 0) {
      const mainFile = results[0];
      response.Main = {
        version: mainFile.version,
        author: mainFile.author,
        date: mainFile.updated_at,
        timeAgo: formatTimeAgo(mainFile.minutes_ago),
        hasFile: true
      };
    }

    // Result[1] adalah fail kedua latest -> Masuk ke Archieve
    if (results.length > 1) {
      const archiveFile = results[1];
      response.Archieve = {
        version: archiveFile.version,
        author: archiveFile.author,
        date: archiveFile.updated_at,
        timeAgo: formatTimeAgo(archiveFile.minutes_ago),
        hasFile: true
      };
    }

    res.json(response);
  });
});

// API: Get Library File List API
app.get('/api/library/files', (req, res) => {
  const { library_id, folder_type, user_id } = req.query;

  if (!library_id || !folder_type) {
    return res.status(400).json({ message: "Missing library_id or folder_type" });
  }

  // 1. Tarik semua fail aktif untuk library ini, susun dari paling baru
  const sql = `
        SELECT 
          f.id, 
          f.file_name, 
          f.version, 
          f.updated_at, 
          f.file_path,
          u.name AS author,
          (SELECT COUNT(*) FROM skyintel.user_acknowledgement ua 
          WHERE ua.files_id = f.id AND ua.user_id = ? AND ua.is_acknowledged = 1) AS is_acknowledged
        FROM skyintel.files f
        LEFT JOIN user u ON f.user_id = u.id
        WHERE f.library_id = ? AND f.isDeleted = 0
        ORDER BY f.created_at DESC
    `;

  db.query(sql, [user_id, library_id], (err, files) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }

    let filteredFiles = [];

    // 2. Logik Pemisahan Main vs Archieve
    if (files.length > 0) {
      if (folder_type === 'Main') {
        // Main folder hanya ambil fail PERTAMA (paling latest)
        filteredFiles = [files[0]];
      } else if (folder_type === 'Archieve') {
        // Archieve folder ambil SEMUA fail KECUALI yang pertama
        filteredFiles = files.slice(1);
      }
    }

    res.json(filteredFiles);
  });
});

// API: File Acknowledgement
app.post('/api/files/acknowledge', (req, res) => {
  const { user_id, file_id } = req.body;

  if (!user_id || !file_id) {
    return res.status(400).json({ message: "Missing user_id or file_id" });
  }

  const timestamp = getCurrentTimestamp(); 

  const sql = `
        UPDATE user_acknowledgement 
        SET is_acknowledged = 1, updated_at = ? 
        WHERE user_id = ? AND files_id = ?
    `;

  db.query(sql, [timestamp, user_id, file_id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Acknowledgement record not found." });
    }

    res.json({ message: "File acknowledged successfully", date: timestamp });
  });
});

// API: Delete Library File (Soft Delete)
app.post('/api/library/files/delete', (req, res) => {
  const { file_id } = req.body;

  // 1. Validasi Input
  if (!file_id) {
    return res.status(400).json({ message: "File ID is required" });
  }

  const timestamp = getCurrentTimestamp();

  const query = `UPDATE files SET isDeleted = 1, updated_at = ? WHERE id = ?`;

  db.query(query, [timestamp, file_id], (err, result) => {
    if (err) {
      console.error("Delete File Error:", err);
      return res.status(500).json({ message: "Database error while deleting file." });
    }

    // Semak jika ID wujud
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "File not found or already deleted." });
    }

    res.status(200).json({ message: "File deleted successfully" });
  });
});

// API: Update Library Folder Name
app.put('/api/library/update', (req, res) => {
    const { id, name } = req.body;

    // 1. Validasi Input
    if (!id || !name) {
        return res.status(400).json({ message: "Library ID and Name are required" });
    }

    const timestamp = getCurrentTimestamp();

    // 2. Update Database
    const query = `UPDATE library SET name = ?, updated_at = ? WHERE id = ?`;

    db.query(query, [name, timestamp, id], (err, result) => {
        if (err) {
            console.error("Update Library Error:", err);
            return res.status(500).json({ message: "Database error" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Library folder not found." });
        }

        res.status(200).json({ message: "Folder name updated successfully" });
    });
});

// API: Soft Delete Library Folder
app.post('/api/library/delete', (req, res) => {
    const { library_id } = req.body;

    // 1. Validasi Input
    if (!library_id) {
        return res.status(400).json({ message: "Library ID is required" });
    }

    const timestamp = getCurrentTimestamp();

    const query = `UPDATE library SET isDeleted = 1, updated_at = ? WHERE id = ?`;

    db.query(query, [timestamp, library_id], (err, result) => {
        if (err) {
            console.error("Delete Library Error:", err);
            return res.status(500).json({ message: "Database error" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Library folder not found." });
        }

        // Optional: Anda mungkin mahu soft-delete semua fail di dalam folder ini juga
        // Tetapi buat masa ini, memadai dengan menyembunyikan foldernya sahaja.

        res.status(200).json({ message: "Folder deleted successfully" });
    });
});

// API: Get Acknowledgement Report for a Library Folder
app.get('/api/library/report/:library_id', (req, res) => {
    const libraryId = req.params.library_id;

    // 1. Cari fail terkini yang aktif dalam library ini
    const findFileQuery = `
        SELECT id FROM files 
        WHERE library_id = ? AND isDeleted = 0 
        ORDER BY created_at DESC LIMIT 1
    `;

    db.query(findFileQuery, [libraryId], (err, fileResult) => {
        if (err) return res.status(500).json({ message: "Database error" });

        // Jika folder kosong (tiada fail)
        if (fileResult.length === 0) {
            return res.json({ hasFile: false, data: [] });
        }

        const fileId = fileResult[0].id;

        // 2. Dapatkan senarai user (Admin/Member) dan status acknowledgement mereka
        // Kita join table User dengan User_Acknowledgement
        const reportQuery = `
            SELECT 
                u.name AS user_name,
                r.name AS role_name,
                COALESCE(ua.is_acknowledged, 0) AS status,
                ua.updated_at AS ack_date
            FROM user u
            INNER JOIN user_role r ON u.user_role_id = r.id
            LEFT JOIN user_acknowledgement ua ON u.id = ua.user_id AND ua.files_id = ?
            WHERE u.user_role_id IN (1, 2, 4) AND u.isDeleted = 0 AND u.isDeactive = 0
            ORDER BY u.name ASC
        `;

        db.query(reportQuery, [fileId], (err, reportData) => {
            if (err) return res.status(500).json({ message: "Database error fetching report" });

            res.json({ 
                hasFile: true, 
                data: reportData 
            });
        });
    });
});

// ============================================================================================
// HELPER FUNCTION
// ============================================================================================

function formatTimeAgo(minutes) {
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

// Haversine Function
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const toRadians = (deg) => (deg * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Serve index.html from subdirectories automatically
app.get('*', (req, res) => {
  const filePath = path.resolve(__dirname, `www${req.url}/index.html`);

  // Check if the index.html file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (!err) {
      // If it exists, send the index.html file
      res.sendFile(filePath);
    } else {
      // If it doesn't exist, send a 404 error
      res.status(404).send('404 Not Found');
    }
  });
});

// Get Current Timestamp
const getCurrentTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 23);
};

// CORS Configuration
const corsOptions = {
  origin: '*', // Allow all origins (update to specific origins in production)
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
};

// Start Server
http.listen(port, host, () => {
  console.log(`WebUI server listening at http://${host}:${port}`);
});