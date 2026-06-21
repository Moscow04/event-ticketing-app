import { useState, useEffect } from 'react';
import { admin as adminApi } from '../services/api';

export default function AdminDashboard() {
  const [tab, setTab] = useState('events');
  const [eventsList, setEventsList] = useState([]);
  const [bookingsList, setBookingsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (tab === 'events' ? adminApi.events({}) : adminApi.bookings({}))
      .then(res => {
        if (tab === 'events') setEventsList(res.data);
        else setBookingsList(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  const toggleStatus = async (id) => {
    try {
      await adminApi.toggleEventStatus(id);
      setEventsList(prev => prev.map(e => e.id === id ? { ...e, status: e.status === 'published' ? 'cancelled' : 'published' } : e));
    } catch {}
  };

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem' }}>Admin Dashboard</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button className={`btn ${tab === 'events' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('events')}>Events</button>
        <button className={`btn ${tab === 'bookings' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('bookings')}>Bookings</button>
      </div>

      {loading ? <p>Loading...</p> : tab === 'events' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {eventsList.map(e => (
            <div key={e.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem' }}>
              <div>
                <p style={{ fontWeight: 600 }}>{e.title}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                  {e.organizer_name} &middot; {new Date(e.start_date).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={`badge ${e.status === 'published' ? 'badge-green' : e.status === 'cancelled' ? 'badge-red' : 'badge-yellow'}`}>
                  {e.status}
                </span>
                <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
                  onClick={() => toggleStatus(e.id)}>
                  {e.status === 'published' ? 'Cancel' : 'Publish'}
                </button>
              </div>
            </div>
          ))}
          {eventsList.length === 0 && <p style={{ color: 'var(--gray-400)', textAlign: 'center' }}>No events</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {bookingsList.map(b => (
            <div key={b.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem' }}>
              <div>
                <p style={{ fontWeight: 600 }}>{b.event_title}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                  {b.user_name} ({b.user_email}) &middot; {b.booking_ref}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: 700 }}>${Number(b.total_amount).toFixed(2)}</p>
                <span className={`badge ${b.status === 'confirmed' ? 'badge-green' : b.status === 'cancelled' ? 'badge-red' : 'badge-yellow'}`}>
                  {b.status}
                </span>
              </div>
            </div>
          ))}
          {bookingsList.length === 0 && <p style={{ color: 'var(--gray-400)', textAlign: 'center' }}>No bookings</p>}
        </div>
      )}
    </div>
  );
}
