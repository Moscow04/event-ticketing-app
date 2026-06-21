import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { bookings as bookingsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const [bookingList, setBookingList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookingsApi.list({ limit: 50 })
      .then(res => setBookingList(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>My Dashboard</h1>
      <p style={{ color: 'var(--gray-500)', marginBottom: '2rem' }}>Welcome back, {user?.name}</p>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>My Bookings</h2>

      {loading ? (
        <p>Loading...</p>
      ) : bookingList.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--gray-400)', marginBottom: '1rem' }}>No bookings yet</p>
          <Link to="/events" className="btn btn-primary">Browse Events</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {bookingList.map(b => (
            <Link key={b.id} to={`/bookings/${b.id}`} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem' }}>
              <div>
                <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{b.event_title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                  {new Date(b.start_date).toLocaleDateString()} &middot; {b.venue}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontFamily: 'monospace' }}>{b.booking_ref}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: 700, color: 'var(--primary)' }}>${Number(b.total_amount).toFixed(2)}</p>
                <span className={`badge ${b.status === 'confirmed' ? 'badge-green' : b.status === 'cancelled' ? 'badge-red' : 'badge-yellow'}`}>
                  {b.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
