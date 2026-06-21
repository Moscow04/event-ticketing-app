import { useState, useEffect } from 'react';
import { events as eventsApi } from '../services/api';
import EventCard from '../components/events/EventCard';

const CATEGORIES = ['', 'concert', 'conference', 'workshop', 'sports', 'theatre', 'festival'];

export default function EventsPage() {
  const [eventList, setEventList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    setLoading(true);
    eventsApi.list({ search, category: category || undefined, page, limit: 12 })
      .then(res => {
        setEventList(res.data);
        setPagination(res.pagination);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, category, page]);

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem' }}>Events</h1>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <input
          className="form-input"
          placeholder="Search events..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: 320 }}
        />
        <select
          className="form-input"
          value={category}
          onChange={e => { setCategory(e.target.value); setPage(1); }}
          style={{ maxWidth: 200 }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.filter(Boolean).map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '3rem 0' }}>Loading...</p>
      ) : eventList.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '3rem 0' }}>No events found</p>
      ) : (
        <>
          <div className="grid-3">
            {eventList.map(event => <EventCard key={event.id} event={event} />)}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
              <button className="btn btn-secondary" disabled={!pagination.hasPrev} onClick={() => setPage(p => p - 1)}>
                Previous
              </button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button className="btn btn-secondary" disabled={!pagination.hasNext} onClick={() => setPage(p => p + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
