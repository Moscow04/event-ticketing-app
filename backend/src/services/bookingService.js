import { query, getClient } from '../config/database.js';
import {
  findEventById, getTicketTypes, createBooking,
  getUserBookings, getBookingDetails,
} from '../models/index.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { generateBookingRef, paginate, buildPaginationMeta } from '../utils/helpers.js';

export async function createNewBooking(userId, bookingData) {
  const event = await findEventById(bookingData.event_id);
  if (!event) throw new NotFoundError('Event');
  if (event.status !== 'published') throw new ValidationError('Event is not available');

  const ticketTypes = await getTicketTypes(bookingData.event_id);
  const ticketMap = Object.fromEntries(ticketTypes.map(t => [t.id, t]));

  let totalAmount = 0;
  const tickets = [];

  for (const item of bookingData.tickets) {
    const tt = ticketMap[item.ticket_type_id];
    if (!tt) throw new NotFoundError(`Ticket type ${item.ticket_type_id}`);
    if (tt.available < item.quantity) {
      throw new ValidationError(`Only ${tt.available} tickets available for "${tt.name}"`);
    }
    totalAmount += parseFloat(tt.price) * item.quantity;
    tickets.push({ ticket_type_id: item.ticket_type_id, quantity: item.quantity, unit_price: tt.price });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const booking = await createBooking({
      userId,
      eventId: bookingData.event_id,
      bookingRef: generateBookingRef(),
      totalAmount,
      tickets,
      client,
    });
    await client.query('COMMIT');
    return booking;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getUserBookingHistory(userId, queryParams) {
  const { page, limit, offset } = paginate(queryParams.page, queryParams.limit);
  const { rows, total } = await getUserBookings(userId, { limit, offset });
  return { data: rows, pagination: buildPaginationMeta(total, page, limit) };
}

export async function getBookingDetailsForUser(bookingId, userId) {
  const booking = await getBookingDetails(bookingId, userId);
  if (!booking) throw new NotFoundError('Booking');
  return booking;
}
