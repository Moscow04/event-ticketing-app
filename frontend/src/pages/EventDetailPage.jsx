import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { events as eventsApi, bookings as bookingsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({});
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    eventsApi.get(id)
      .then(res => {
        setEvent(res.data);
        const q = {};
        res.data.ticket_types?.forEach(t => { q[t.id] = 0; });
        setQuantities(q);
      })
      .catch(() => navigate('/events'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const total = event?.ticket_types?.reduce((sum, t) => sum + (quantities[t.id] || 0) * parseFloat(t.price), 0) || 0;

  const handleBooking = async () => {
    if (!user) { navigate('/login'); return; }
    const tickets = Object.entries(quantities).filter(([, q]) => q > 0).map(([ticket_type_id, quantity]) => ({ ticket_type_id, quantity }));
    if (tickets.length === 0) { setError('Select at least one ticket'); return; }

    setProcessing(true);
    setError('');
    try {
      const res = await bookingsApi.create({ event_id: id, tickets });
      navigate(`/bookings/${res.data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>Loading...</div>;
  if (!event) return null;

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'start' }}>
        <div>
          <div style={{
            height: 300,
            borderRadius: 'var(--radius-lg)',
            background: `linear-gradient(135deg, #6366f1, #a5b4fc)`,
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-end',
            padding: '1.5rem',
          }}>
            <div>
              <span className="badge badge-primary" style={{ marginBottom: '0.5rem', display: 'inline-block' }}>
                {event.category}
              </span>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white' }}>{event.title}</h1>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Venue</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{event.venue}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Organizer</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{event.organizer_name}</p>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>About This Event</h2>
            <p style={{ color: 'var(--gray-600)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{event.description}</p>
          </div>
        </div>

        <div className="card" style={{ position: 'sticky', top: 88 }}>
          <div style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Tickets</h3>

            {event.ticket_types?.map(tt => (
              <div key={tt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--gray-100)' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{tt.name}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>${Number(tt.price).toFixed(2)}</p>
                  <p style={{ fontSize: '0.75rem', color: tt.available < 10 ? 'var(--red-500)' : 'var(--gray-400)' }}>
                    {tt.available} left
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', minWidth: 32 }}
                    disabled={!quantities[tt.id]}
                    onClick={() => setQuantities(q => ({ ...q, [tt.id]: Math.max(0, q[tt.id] - 1) }))}
                  >
                    -
                  </button>
                  <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{quantities[tt.id] || 0}</span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', minWidth: 32 }}
                    disabled={(quantities[tt.id] || 0) >= tt.available}
                    onClick={() => setQuantities(q => ({ ...q, [tt.id]: Math.min(tt.available, (q[tt.id] || 0) + 1) }))}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderTop: '2px solid var(--gray-200)', marginTop: '0.5rem' }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                ${total.toFixed(2)}
              </span>
            </div>

            {error && (
              <div style={{ background: 'var(--red-100)', color: 'var(--red-500)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
              disabled={total === 0 || processing}
              onClick={handleBooking}
            >
              {processing ? 'Processing...' : user ? 'Book Now' : 'Sign In to Book'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
