import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { bookings as bookingsApi } from '../services/api';

export default function BookingConfirmPage() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookingsApi.get(id)
      .then(res => setBooking(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>Loading...</div>;
  if (!booking) return <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>Booking not found</div>;

  return (
    <div className="container" style={{ maxWidth: 640, padding: '3rem 1rem' }}>
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--green-100)', color: 'var(--green-500)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', margin: '0 auto 1rem', fontWeight: 700,
        }}>
          &#10003;
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Booking Confirmed!</h1>
        <p style={{ color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
          Reference: <strong style={{ fontFamily: 'monospace', color: 'var(--gray-800)' }}>{booking.booking_ref}</strong>
        </p>

        <div style={{ borderTop: '1px solid var(--gray-200)', borderBottom: '1px solid var(--gray-200)', padding: '1.5rem 0', marginBottom: '1.5rem', textAlign: 'left' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{booking.event_title}</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '0.25rem' }}>
            {new Date(booking.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '0.25rem' }}>{booking.venue}</p>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '0.25rem' }}>Total Paid</p>
          <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>${Number(booking.total_amount).toFixed(2)}</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link to="/dashboard" className="btn btn-primary">View My Bookings</Link>
          <Link to="/events" className="btn btn-outline">Browse More Events</Link>
        </div>
      </div>
    </div>
  );
}
