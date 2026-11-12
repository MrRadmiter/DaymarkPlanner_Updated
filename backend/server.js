const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());

let db = { users: {}, data: {} };

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    db = { users: {}, data: {} };
  }
}

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (db.users[username]) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const token = generateToken();
  db.users[username] = { password, token };
  db.data[username] = [];
  saveDb();

  res.json({ username, token });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users[username];

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ username, token: user.token });
});

app.post('/sync', (req, res) => {
  const token = req.headers.authorization;
  const username = Object.keys(db.users).find((u) => db.users[u].token === token);

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (Array.isArray(req.body.entries)) {
    db.data[username] = req.body.entries;
    saveDb();
  }

  res.json({ entries: db.data[username] || [] });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
