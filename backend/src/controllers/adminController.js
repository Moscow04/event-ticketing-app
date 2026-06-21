import * as eventService from '../services/eventService.js';
import { adminGetEvents, adminGetBookings } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginate, buildPaginationMeta } from '../utils/helpers.js';

export const getAllEvents = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);
  const { rows, total } = await adminGetEvents({
    status: req.query.status,
    page, limit, offset,
  });
  res.json({ success: true, data: rows, pagination: buildPaginationMeta(total, page, limit) });
});

export const getAllBookings = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);
  const { rows, total } = await adminGetBookings({ page, limit, offset });
  res.json({ success: true, data: rows, pagination: buildPaginationMeta(total, page, limit) });
});

export const toggleEventStatus = asyncHandler(async (req, res) => {
  const { query } = await import('../config/database.js');
  const { id } = req.params;
  const event = await query('SELECT status FROM events WHERE id = $1', [id]);
  if (event.rows.length === 0) {
    return res.status(404).json({ success: false, error: { message: 'Event not found' } });
  }
  const newStatus = event.rows[0].status === 'published' ? 'cancelled' : 'published';
  const result = await query(
    'UPDATE events SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [newStatus, id]
  );
  res.json({ success: true, data: result.rows[0] });
});
