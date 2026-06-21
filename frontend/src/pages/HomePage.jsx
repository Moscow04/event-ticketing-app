import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { events as eventsApi } from '../services/api';
import EventCard from '../components/events/EventCard';

export default function HomePage() {
  const [eventList, setEventList] = useState([]);

  useEffect(() => {
    eventsApi.list({ limit: 6 }).then(res => setEventList(res.data)).catch(() => {});
  }, []);

  return (
    <div>
      <section style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #818cf8 100%)',
        padding: '5rem 0',
        textAlign: 'center',
        color: 'white',
      }}>
        <div className="container">
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.2 }}>
            Discover Amazing Events
          </h1>
          <p style={{ fontSize: '1.125rem', opacity: 0.9, marginBottom: '2rem', maxWidth: 600, margin: '0 auto 2rem' }}>
            Book tickets for concerts, conferences, workshops, and more. Your next experience starts here.
          </p>
          <Link to="/events" className="btn" style={{
            background: 'white',
            color: 'var(--primary)',
            padding: '0.875rem 2rem',
            fontSize: '1rem',
            fontWeight: 700,
          }}>
            Browse Events
          </Link>
        </div>
      </section>

      <section className="container" style={{ padding: '4rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Upcoming Events</h2>
          <Link to="/events" className="btn btn-outline" style={{ fontSize: '0.875rem' }}>
            View All
          </Link>
        </div>

        {eventList.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '3rem 0' }}>No events found</p>
        ) : (
          <div className="grid-3">
            {eventList.map(event => <EventCard key={event.id} event={event} />)}
          </div>
        )}
      </section>
    </div>
  );
}
