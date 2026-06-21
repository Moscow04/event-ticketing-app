import { query } from '../config/database.js';

export async function findUserByEmail(email) {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function createUser({ name, email, passwordHash, role = 'attendee' }) {
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name, email, passwordHash, role]
  );
  return result.rows[0];
}

export async function findEventById(id) {
  const result = await query(
    `SELECT e.*, u.name as organizer_name
     FROM events e JOIN users u ON e.organizer_id = u.id
     WHERE e.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function createEvent({ title, description, venue, startDate, endDate, category, bannerUrl, organizerId }) {
  const result = await query(
    `INSERT INTO events (title, description, venue, start_date, end_date, category, banner_url, organizer_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [title, description, venue, startDate, endDate, category, bannerUrl, organizerId]
  );
  return result.rows[0];
}

export async function listEvents({ status, category, search, page, limit, offset }) {
  let sql = `SELECT e.*, u.name as organizer_name FROM events e JOIN users u ON e.organizer_id = u.id WHERE 1=1`;
  const params = [];
  let idx = 1;

  if (status) {
    sql += ` AND e.status = $${idx++}`;
    params.push(status);
  } else {
    sql += ` AND e.status = 'published'`;
  }
  if (category) {
    sql += ` AND e.category = $${idx++}`;
    params.push(category);
  }
  if (search) {
    sql += ` AND (e.title ILIKE $${idx} OR e.description ILIKE $${idx} OR e.venue ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  const countResult = await query(`SELECT COUNT(*) FROM (${sql}) sub`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  sql += ` ORDER BY e.start_date ASC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return { rows: result.rows, total };
}

export async function getTicketTypes(eventId) {
  const result = await query(
    'SELECT * FROM ticket_types WHERE event_id = $1 ORDER BY price ASC',
    [eventId]
  );
  return result.rows;
}

export async function createTicketTypes(eventId, types) {
  const values = types.map((t, i) =>
    `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`
  ).join(', ');
  const params = types.flatMap(t => [eventId, t.name, t.description || '', t.price, t.quantity, t.quantity]);
  const result = await query(
    `INSERT INTO ticket_types (event_id, name, description, price, quantity, available)
     VALUES ${values} RETURNING *`,
    params
  );
  return result.rows;
}

export async function createBooking({ userId, eventId, bookingRef, totalAmount, tickets, client }) {
  const doQuery = client ? client.query.bind(client) : query;

  const bookingResult = await doQuery(
    `INSERT INTO bookings (user_id, event_id, booking_ref, total_amount, status)
     VALUES ($1, $2, $3, $4, 'confirmed') RETURNING *`,
    [userId, eventId, bookingRef, totalAmount]
  );
  const booking = bookingResult.rows[0];

  for (const t of tickets) {
    await doQuery(
      `INSERT INTO booking_tickets (booking_id, ticket_type_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4)`,
      [booking.id, t.ticket_type_id, t.quantity, t.unit_price]
    );
    await doQuery(
      `UPDATE ticket_types SET available = available - $1 WHERE id = $2 AND available >= $1`,
      [t.quantity, t.ticket_type_id]
    );
  }

  return booking;
}

export async function getUserBookings(userId, { limit, offset }) {
  const countResult = await query('SELECT COUNT(*) FROM bookings WHERE user_id = $1', [userId]);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    `SELECT b.*, e.title as event_title, e.start_date, e.venue
     FROM bookings b JOIN events e ON b.event_id = e.id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return { rows: result.rows, total };
}

export async function getBookingDetails(bookingId, userId) {
  const result = await query(
    `SELECT b.*, e.title as event_title, e.start_date, e.end_date, e.venue, e.description
     FROM bookings b JOIN events e ON b.event_id = e.id
     WHERE b.id = $1 AND b.user_id = $2`,
    [bookingId, userId]
  );
  if (result.rows.length === 0) return null;

  const tickets = await query(
    `SELECT bt.*, tt.name as ticket_name
     FROM booking_tickets bt JOIN ticket_types tt ON bt.ticket_type_id = tt.id
     WHERE bt.booking_id = $1`,
    [bookingId]
  );
  return { ...result.rows[0], tickets: tickets.rows };
}

export async function adminGetEvents({ status, page, limit, offset }) {
  let sql = `SELECT e.*, u.name as organizer_name FROM events e JOIN users u ON e.organizer_id = u.id`;
  const params = [];
  let idx = 1;

  if (status) {
    sql += ` WHERE e.status = $${idx++}`;
    params.push(status);
  }

  const countResult = await query(`SELECT COUNT(*) FROM (${sql}) sub`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  sql += ` ORDER BY e.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return { rows: result.rows, total };
}

export async function adminGetBookings({ page, limit, offset }) {
  const countResult = await query('SELECT COUNT(*) FROM bookings');
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    `SELECT b.*, u.name as user_name, u.email as user_email, e.title as event_title
     FROM bookings b
     JOIN users u ON b.user_id = u.id
     JOIN events e ON b.event_id = e.id
     ORDER BY b.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return { rows: result.rows, total };
}
