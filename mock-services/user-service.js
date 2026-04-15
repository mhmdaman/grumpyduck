// ─────────────────────────────────────────────────────────────
// Mock User Service (port 3001)
// ─────────────────────────────────────────────────────────────
// This simulates a real user microservice.
// In production, this would be a separate project/repo.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const PORT = process.env.USER_SERVICE_PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(express.json());

// In-memory user store (in production, this would be MongoDB/Postgres)
const users = [];

// ─── POST /api/users/register ───────────────────────────────
app.post('/api/users/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }

  if (users.find((u) => u.email === email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const user = {
    id: `user_${Date.now()}`,
    name,
    email,
    password, // In production: bcrypt hash!
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  users.push(user);

  // Return user without password
  const { password: _, ...safeUser } = user;
  res.status(201).json({ message: 'User registered', user: safeUser });
});

// ─── POST /api/users/login ──────────────────────────────────
app.post('/api/users/login', (req, res) => {
  const { email, password } = req.body;

  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email } });
});

// ─── GET /api/users/profile ─────────────────────────────────
// Protected route — gateway will forward x-user-id header
app.get('/api/users/profile', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'No user ID provided by gateway' });
  }

  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

// ─── GET /api/users ─────────────────────────────────────────
app.get('/api/users', (req, res) => {
  const safeUsers = users.map(({ password, ...u }) => u);
  res.json({ users: safeUsers, total: safeUsers.length });
});

// ─── Health Check ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service', port: PORT });
});

app.listen(PORT, () => {
  console.log(`👤 User Service running on port ${PORT}`);
});

module.exports = app;
