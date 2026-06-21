import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import {
  findEventById, createEvent, listEvents,
  getTicketTypes, createTicketTypes,
} from '../models/index.js';
import { paginate, buildPaginationMeta } from '../utils/helpers.js';

export async function createNewEvent(data, organizerId) {
  const event = await createEvent({
    title: data.title,
    description: data.description,
    venue: data.venue,
    startDate: data.start_date,
    endDate: data.end_date,
    category: data.category,
    bannerUrl: data.banner_url || null,
    organizerId,
  });

  const ticketTypes = await createTicketTypes(event.id, data.ticket_types);
  return { ...event, ticket_types: ticketTypes };
}

export async function getAllPublishedEvents(queryParams) {
  const { page, limit, offset } = paginate(queryParams.page, queryParams.limit);
  const { rows, total } = await listEvents({
    status: 'published',
    category: queryParams.category,
    search: queryParams.search,
    page, limit, offset,
  });

  const eventsWithTickets = await Promise.all(
    rows.map(async (event) => {
      const tickets = await getTicketTypes(event.id);
      return { ...event, ticket_types: tickets };
    })
  );

  return { data: eventsWithTickets, pagination: buildPaginationMeta(total, page, limit) };
}

export async function getEventDetails(eventId) {
  const event = await findEventById(eventId);
  if (!event) throw new NotFoundError('Event');

  const ticketTypes = await getTicketTypes(eventId);
  return { ...event, ticket_types: ticketTypes };
}

export async function updateExistingEvent(eventId, data, userId) {
  const event = await findEventById(eventId);
  if (!event) throw new NotFoundError('Event');
  if (event.organizer_id !== userId) throw new ForbiddenError('Not your event');

  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      const dbKey = key === 'start_date' || key === 'end_date' || key === 'banner_url' ? key : key;
      fields.push(`${dbKey} = $${idx++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) return event;

  values.push(eventId);
  const { query } = await import('../config/database.js');
  const result = await query(
    `UPDATE events SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0];
}
