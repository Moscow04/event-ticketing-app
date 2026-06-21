import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import config from '../src/config/index.js';

async function seed() {
  const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'event_ticketing',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    console.log('Seeding database...');

    const adminHash = await bcrypt.hash(config.admin.password, 12);
    const adminResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      ['Admin', config.admin.email, adminHash, 'admin']
    );

    if (adminResult.rows.length > 0) {
      console.log(`Admin created: ${config.admin.email}`);
    } else {
      console.log('Admin already exists');
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [config.admin.email]);
      adminResult.rows[0] = existing.rows[0];
    }

    const organizerHash = await bcrypt.hash('Organizer@123', 12);
    const orgResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      ['Demo Organizer', 'organizer@eventtix.com', organizerHash, 'organizer']
    );
    if (orgResult.rows.length > 0) {
      console.log('Demo organizer created');
    }

    const attendeeHash = await bcrypt.hash('Attendee@123', 12);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      ['Demo Attendee', 'attendee@eventtix.com', attendeeHash, 'attendee']
    );

    const orgRow = orgResult.rows[0] || (await pool.query('SELECT id FROM users WHERE email = $1', ['organizer@eventtix.com'])).rows[0];

    if (orgRow) {
      const sampleEvents = [
        {
          title: 'Summer Music Festival 2026',
          description: 'An incredible outdoor music festival featuring top artists from around the world. Enjoy live performances, food stalls, and a vibrant atmosphere.',
          venue: 'Central Park Amphitheatre, New York',
          start_date: '2026-08-15T16:00:00Z',
          end_date: '2026-08-17T23:00:00Z',
          category: 'concert',
          ticketTypes: [
            { name: 'General Admission', price: 79.99, quantity: 500 },
            { name: 'VIP Pass', price: 199.99, quantity: 100 },
            { name: 'Backstage Access', price: 499.99, quantity: 20 },
          ],
        },
        {
          title: 'TechConf 2026',
          description: 'The premier technology conference covering AI, cloud computing, cybersecurity, and software development trends.',
          venue: 'Convention Center, San Francisco',
          start_date: '2026-09-10T08:00:00Z',
          end_date: '2026-09-12T18:00:00Z',
          category: 'conference',
          ticketTypes: [
            { name: 'Standard', price: 299.99, quantity: 1000 },
            { name: 'Premium + Workshops', price: 599.99, quantity: 300 },
          ],
        },
        {
          title: 'React Workshop: Build from Scratch',
          description: 'A hands-on workshop where you will build a complete React application from the ground up. Laptop required.',
          venue: 'WeWork Coworking Space, Austin',
          start_date: '2026-07-05T09:00:00Z',
          end_date: '2026-07-05T17:00:00Z',
          category: 'workshop',
          ticketTypes: [
            { name: 'Early Bird', price: 149.99, quantity: 30 },
            { name: 'Regular', price: 199.99, quantity: 40 },
          ],
        },
      ];

      for (const ev of sampleEvents) {
        const eventResult = await pool.query(
          `INSERT INTO events (title, description, venue, start_date, end_date, category, status, organizer_id)
           VALUES ($1, $2, $3, $4, $5, $6, 'published', $7)
           ON CONFLICT DO NOTHING RETURNING id`,
          [ev.title, ev.description, ev.venue, ev.start_date, ev.end_date, ev.category, orgRow.id]
        );

        if (eventResult.rows.length > 0) {
          for (const tt of ev.ticketTypes) {
            await pool.query(
              `INSERT INTO ticket_types (event_id, name, price, quantity, available)
               VALUES ($1, $2, $3, $4, $5)`,
              [eventResult.rows[0].id, tt.name, tt.price, tt.quantity, tt.quantity]
            );
          }
          console.log(`Event created: ${ev.title}`);
        }
      }
    }

    console.log('Seeding completed successfully');
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
