import { Link } from 'react-router-dom';

const CATEGORY_COLORS = {
  concert: '#8b5cf6',
  conference: '#3b82f6',
  workshop: '#10b981',
  sports: '#f59e0b',
  theatre: '#ec4899',
  festival: '#f97316',
  other: '#6b7280',
};

export default function EventCard({ event }) {
  const minPrice = event.ticket_types?.length
    ? Math.min(...event.ticket_types.map(t => t.price))
    : 0;

  return (
    <Link to={`/events/${event.id}`} className="card" style={{ display: 'block', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
      <div style={{ height: 180, background: `linear-gradient(135deg, ${CATEGORY_COLORS[event.category] || '#6b7280'}, ${CATEGORY_COLORS[event.category] || '#6b7280'}88)`, display: 'flex', alignItems: 'flex-end', padding: '1rem' }}>
        <span className="badge" style={{ background: 'rgba(255,255,255,0.9)', color: 'var(--gray-800)' }}>
          {event.category}
        </span>
      </div>
      <div style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', lineHeight: 1.3 }}>{event.title}</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '0.5rem' }}>
          {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>{event.venue}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
            From ${Number(minPrice).toFixed(2)}
          </span>
        </div>
      </div>
    </Link>
  );
}
