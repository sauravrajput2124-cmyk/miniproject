const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { exec } = require('child_process');
const db = require('./db/database');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname), {
  index: 'index.html'
}));

app.use(session({
  secret: 'ev-charging-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    if (req.session.role !== role) return res.status(403).json({ error: 'Access denied' });
    next();
  };
}

function generateRequestId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REQ-${timestamp}-${random}`;
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────

// Register EV Owner
app.post('/api/auth/register/ev-owner', (req, res) => {
  const { full_name, email, password, phone, vehicle_name, vehicle_model, vehicle_number } = req.body;
  if (!full_name || !email || !password || !phone || !vehicle_name || !vehicle_model || !vehicle_number) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hashed = bcrypt.hashSync(password, 10);
  const insert = db.prepare(`INSERT INTO users (full_name, email, password, phone, role) VALUES (?, ?, ?, ?, 'ev_owner')`);
  const result = insert.run(full_name, email.toLowerCase().trim(), hashed, phone);
  const userId = result.lastInsertRowid;

  db.prepare('INSERT INTO vehicles (user_id, vehicle_name, vehicle_model, vehicle_number) VALUES (?, ?, ?, ?)')
    .run(userId, vehicle_name, vehicle_model, vehicle_number);

  const user = db.prepare('SELECT id, full_name, email, phone, role FROM users WHERE id = ?').get(userId);
  req.session.userId = user.id;
  req.session.role = user.role;
  res.json({ success: true, user });
});

// Register Charger Provider
app.post('/api/auth/register/charger-provider', (req, res) => {
  const {
    full_name, email, password, phone, whatsapp,
    station_name, full_address, city, pin_code, charger_type,
    charging_capacity, charging_price, available_days, starting_time,
    closing_time, avg_charging_duration, num_charging_points, description
  } = req.body;

  if (!full_name || !email || !password || !phone || !station_name || !full_address || !city || !charger_type || !charging_capacity || !charging_price || !available_days || !starting_time || !closing_time) {
    return res.status(400).json({ error: 'All required fields must be filled' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hashed = bcrypt.hashSync(password, 10);
  const userResult = db.prepare(`INSERT INTO users (full_name, email, password, phone, role, whatsapp) VALUES (?, ?, ?, ?, 'charger_provider', ?)`)
    .run(full_name, email.toLowerCase().trim(), hashed, phone, whatsapp || phone);
  const userId = userResult.lastInsertRowid;

  db.prepare(`
    INSERT INTO charging_stations (provider_id, station_name, full_address, city, pin_code, charger_type, charging_capacity, charging_price, available_days, starting_time, closing_time, avg_charging_duration, num_charging_points, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, station_name, full_address, city, pin_code || '', charger_type, parseFloat(charging_capacity), parseFloat(charging_price), available_days, starting_time, closing_time, parseInt(avg_charging_duration) || 60, parseInt(num_charging_points) || 1, description || '');

  const user = db.prepare('SELECT id, full_name, email, phone, role, whatsapp FROM users WHERE id = ?').get(userId);
  req.session.userId = user.id;
  req.session.role = user.role;
  res.json({ success: true, user });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  req.session.userId = user.id;
  req.session.role = user.role;
  res.json({ success: true, user: { id: user.id, full_name: user.full_name, email: user.email, phone: user.phone, role: user.role, whatsapp: user.whatsapp } });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, full_name, email, phone, role, whatsapp FROM users WHERE id = ?').get(req.session.userId);
  if (!user) { req.session.destroy(); return res.status(401).json({ error: 'Session invalid' }); }
  res.json({ user });
});

// ─── STATION ROUTES ───────────────────────────────────────────────────────────

// Get all stations (with optional filters)
app.get('/api/stations', (req, res) => {
  const { city, charger_type, available, max_price, search } = req.query;
  let query = `
    SELECT cs.*, u.full_name as provider_name, u.phone as provider_phone, u.whatsapp as provider_whatsapp
    FROM charging_stations cs
    JOIN users u ON cs.provider_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (city) { query += ' AND LOWER(cs.city) LIKE ?'; params.push(`%${city.toLowerCase()}%`); }
  if (search) { query += ' AND (LOWER(cs.city) LIKE ? OR LOWER(cs.station_name) LIKE ? OR LOWER(cs.full_address) LIKE ?)'; params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`); }
  if (charger_type) { query += ' AND cs.charger_type = ?'; params.push(charger_type); }
  if (available === '1') { query += ' AND cs.is_available = 1'; }
  if (max_price) { query += ' AND cs.charging_price <= ?'; params.push(parseFloat(max_price)); }
  query += ' ORDER BY cs.created_at DESC';

  const stations = db.prepare(query).all(...params);
  res.json({ stations });
});

// Get charger provider's own stations
app.get('/api/stations/my', requireRole('charger_provider'), (req, res) => {
  const stations = db.prepare(`
    SELECT cs.*, u.full_name as provider_name, u.phone as provider_phone, u.whatsapp as provider_whatsapp
    FROM charging_stations cs
    JOIN users u ON cs.provider_id = u.id
    WHERE cs.provider_id = ?
    ORDER BY cs.created_at DESC
  `).all(req.session.userId);
  res.json({ stations });
});

// Get single station
app.get('/api/stations/:id', (req, res) => {
  const station = db.prepare(`
    SELECT cs.*, u.full_name as provider_name, u.phone as provider_phone, u.whatsapp as provider_whatsapp
    FROM charging_stations cs
    JOIN users u ON cs.provider_id = u.id
    WHERE cs.id = ?
  `).get(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  res.json({ station });
});

// Add new station (charger provider)
app.post('/api/stations', requireRole('charger_provider'), (req, res) => {
  const { station_name, full_address, city, pin_code, charger_type, charging_capacity, charging_price, available_days, starting_time, closing_time, avg_charging_duration, num_charging_points, description } = req.body;
  if (!station_name || !full_address || !city || !charger_type || !charging_capacity || !charging_price || !available_days || !starting_time || !closing_time) {
    return res.status(400).json({ error: 'Required fields missing' });
  }
  const result = db.prepare(`
    INSERT INTO charging_stations (provider_id, station_name, full_address, city, pin_code, charger_type, charging_capacity, charging_price, available_days, starting_time, closing_time, avg_charging_duration, num_charging_points, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.session.userId, station_name, full_address, city, pin_code || '', charger_type, parseFloat(charging_capacity), parseFloat(charging_price), available_days, starting_time, closing_time, parseInt(avg_charging_duration) || 60, parseInt(num_charging_points) || 1, description || '');

  const station = db.prepare('SELECT * FROM charging_stations WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, station });
});

// Update station
app.put('/api/stations/:id', requireRole('charger_provider'), (req, res) => {
  const station = db.prepare('SELECT * FROM charging_stations WHERE id = ? AND provider_id = ?').get(req.params.id, req.session.userId);
  if (!station) return res.status(404).json({ error: 'Station not found or access denied' });

  const { station_name, full_address, city, pin_code, charger_type, charging_capacity, charging_price, available_days, starting_time, closing_time, avg_charging_duration, num_charging_points, description, is_available } = req.body;
  db.prepare(`
    UPDATE charging_stations SET station_name=?, full_address=?, city=?, pin_code=?, charger_type=?, charging_capacity=?, charging_price=?, available_days=?, starting_time=?, closing_time=?, avg_charging_duration=?, num_charging_points=?, description=?, is_available=?
    WHERE id = ? AND provider_id = ?
  `).run(
    station_name || station.station_name,
    full_address || station.full_address,
    city || station.city,
    pin_code !== undefined ? pin_code : station.pin_code,
    charger_type || station.charger_type,
    charging_capacity !== undefined ? parseFloat(charging_capacity) : station.charging_capacity,
    charging_price !== undefined ? parseFloat(charging_price) : station.charging_price,
    available_days || station.available_days,
    starting_time || station.starting_time,
    closing_time || station.closing_time,
    avg_charging_duration !== undefined ? parseInt(avg_charging_duration) : station.avg_charging_duration,
    num_charging_points !== undefined ? parseInt(num_charging_points) : station.num_charging_points,
    description !== undefined ? description : station.description,
    is_available !== undefined ? (is_available ? 1 : 0) : station.is_available,
    req.params.id,
    req.session.userId
  );
  const updated = db.prepare('SELECT * FROM charging_stations WHERE id = ?').get(req.params.id);
  res.json({ success: true, station: updated });
});

// Toggle availability
app.patch('/api/stations/:id/availability', requireRole('charger_provider'), (req, res) => {
  const { is_available } = req.body;
  const station = db.prepare('SELECT id FROM charging_stations WHERE id = ? AND provider_id = ?').get(req.params.id, req.session.userId);
  if (!station) return res.status(404).json({ error: 'Station not found or access denied' });
  db.prepare('UPDATE charging_stations SET is_available = ? WHERE id = ?').run(is_available ? 1 : 0, req.params.id);
  res.json({ success: true });
});

// Delete station
app.delete('/api/stations/:id', requireRole('charger_provider'), (req, res) => {
  const station = db.prepare('SELECT id FROM charging_stations WHERE id = ? AND provider_id = ?').get(req.params.id, req.session.userId);
  if (!station) return res.status(404).json({ error: 'Station not found or access denied' });
  db.prepare('DELETE FROM charging_stations WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── REQUEST ROUTES ───────────────────────────────────────────────────────────

// Submit charging request (EV owner)
app.post('/api/requests', requireRole('ev_owner'), (req, res) => {
  const { station_id, phone, vehicle_name, vehicle_number, preferred_date, preferred_time, required_duration, message } = req.body;
  if (!station_id || !phone || !vehicle_name || !vehicle_number || !preferred_date || !preferred_time || !required_duration) {
    return res.status(400).json({ error: 'All required fields must be filled' });
  }
  const station = db.prepare('SELECT id FROM charging_stations WHERE id = ?').get(station_id);
  if (!station) return res.status(404).json({ error: 'Station not found' });

  const requestId = generateRequestId();
  db.prepare(`
    INSERT INTO charging_requests (request_id, ev_owner_id, station_id, phone, vehicle_name, vehicle_number, preferred_date, preferred_time, required_duration, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(requestId, req.session.userId, station_id, phone, vehicle_name, vehicle_number, preferred_date, preferred_time, parseInt(required_duration), message || '');

  const request = db.prepare(`
    SELECT cr.*, cs.station_name, u.full_name as provider_name
    FROM charging_requests cr
    JOIN charging_stations cs ON cr.station_id = cs.id
    JOIN users u ON cs.provider_id = u.id
    WHERE cr.request_id = ?
  `).get(requestId);
  res.json({ success: true, request });
});

// Get EV owner's own requests
app.get('/api/requests/my', requireRole('ev_owner'), (req, res) => {
  const requests = db.prepare(`
    SELECT cr.*, cs.station_name, cs.full_address, cs.city, u.full_name as provider_name, u.phone as provider_phone, u.whatsapp as provider_whatsapp
    FROM charging_requests cr
    JOIN charging_stations cs ON cr.station_id = cs.id
    JOIN users u ON cs.provider_id = u.id
    WHERE cr.ev_owner_id = ?
    ORDER BY cr.created_at DESC
  `).all(req.session.userId);
  res.json({ requests });
});

// Get incoming requests for charger provider
app.get('/api/requests/incoming', requireRole('charger_provider'), (req, res) => {
  const requests = db.prepare(`
    SELECT cr.*, cs.station_name, cs.city, owner.full_name as ev_owner_name
    FROM charging_requests cr
    JOIN charging_stations cs ON cr.station_id = cs.id
    JOIN users owner ON cr.ev_owner_id = owner.id
    WHERE cs.provider_id = ?
    ORDER BY cr.created_at DESC
  `).all(req.session.userId);
  res.json({ requests });
});

// Update request status (charger provider)
app.patch('/api/requests/:id/status', requireRole('charger_provider'), (req, res) => {
  const { status } = req.body;
  const allowed = ['ACCEPTED', 'REJECTED', 'COMPLETED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const request = db.prepare(`
    SELECT cr.id FROM charging_requests cr
    JOIN charging_stations cs ON cr.station_id = cs.id
    WHERE cr.id = ? AND cs.provider_id = ?
  `).get(req.params.id, req.session.userId);
  if (!request) return res.status(404).json({ error: 'Request not found or access denied' });

  db.prepare('UPDATE charging_requests SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// Cancel request (EV owner)
app.patch('/api/requests/:id/cancel', requireRole('ev_owner'), (req, res) => {
  const request = db.prepare('SELECT id, status FROM charging_requests WHERE id = ? AND ev_owner_id = ?').get(req.params.id, req.session.userId);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status === 'COMPLETED') return res.status(400).json({ error: 'Cannot cancel a completed request' });
  db.prepare("UPDATE charging_requests SET status = 'CANCELLED' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// ─── DASHBOARD ROUTES ─────────────────────────────────────────────────────────

app.get('/api/dashboard/ev-owner', requireRole('ev_owner'), (req, res) => {
  const userId = req.session.userId;
  const total_stations = db.prepare('SELECT COUNT(*) as cnt FROM charging_stations').get().cnt;
  const available_stations = db.prepare('SELECT COUNT(*) as cnt FROM charging_stations WHERE is_available = 1').get().cnt;
  const pending_requests = db.prepare("SELECT COUNT(*) as cnt FROM charging_requests WHERE ev_owner_id = ? AND status = 'PENDING'").get(userId).cnt;
  const accepted_requests = db.prepare("SELECT COUNT(*) as cnt FROM charging_requests WHERE ev_owner_id = ? AND status = 'ACCEPTED'").get(userId).cnt;
  res.json({ total_stations, available_stations, pending_requests, accepted_requests });
});

app.get('/api/dashboard/charger-provider', requireRole('charger_provider'), (req, res) => {
  const userId = req.session.userId;
  const total_stations = db.prepare('SELECT COUNT(*) as cnt FROM charging_stations WHERE provider_id = ?').get(userId).cnt;
  const total_points = db.prepare('SELECT SUM(num_charging_points) as total FROM charging_stations WHERE provider_id = ?').get(userId).total || 0;
  const total_requests = db.prepare('SELECT COUNT(*) as cnt FROM charging_requests cr JOIN charging_stations cs ON cr.station_id = cs.id WHERE cs.provider_id = ?').get(userId).cnt;
  const pending_requests = db.prepare("SELECT COUNT(*) as cnt FROM charging_requests cr JOIN charging_stations cs ON cr.station_id = cs.id WHERE cs.provider_id = ? AND cr.status = 'PENDING'").get(userId).cnt;
  const accepted_requests = db.prepare("SELECT COUNT(*) as cnt FROM charging_requests cr JOIN charging_stations cs ON cr.station_id = cs.id WHERE cs.provider_id = ? AND cr.status = 'ACCEPTED'").get(userId).cnt;
  const completed_requests = db.prepare("SELECT COUNT(*) as cnt FROM charging_requests cr JOIN charging_stations cs ON cr.station_id = cs.id WHERE cs.provider_id = ? AND cr.status = 'COMPLETED'").get(userId).cnt;
  res.json({ total_stations, total_points, total_requests, pending_requests, accepted_requests, completed_requests });
});

// ─── PROFILE ROUTES ───────────────────────────────────────────────────────────

app.get('/api/profile', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, full_name, email, phone, role, whatsapp FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  let extra = {};
  if (user.role === 'ev_owner') {
    extra.vehicle = db.prepare('SELECT * FROM vehicles WHERE user_id = ?').get(req.session.userId);
  } else {
    extra.stations = db.prepare('SELECT * FROM charging_stations WHERE provider_id = ?').all(req.session.userId);
  }
  res.json({ user, ...extra });
});

app.put('/api/profile', requireAuth, (req, res) => {
  const { full_name, phone, whatsapp } = req.body;
  db.prepare('UPDATE users SET full_name = ?, phone = ?, whatsapp = ? WHERE id = ?')
    .run(full_name, phone, whatsapp || '', req.session.userId);
  const user = db.prepare('SELECT id, full_name, email, phone, role, whatsapp FROM users WHERE id = ?').get(req.session.userId);
  res.json({ success: true, user });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── START SERVER ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('\n=============================================================');
  console.log('⚡ Smart EV Charging Station Finder v2.0 - Full Stack');
  console.log(`👉 Local:   ${url}`);
  console.log('=============================================================');
  console.log('Demo Accounts:');
  console.log('  EV Owner:  rahul@example.com / owner123');
  console.log('  Provider 1: priya@example.com / provider123');
  console.log('  Provider 2: ankit@example.com / provider456');
  console.log('=============================================================\n');

  exec(`start ${url}`, () => {});
});
