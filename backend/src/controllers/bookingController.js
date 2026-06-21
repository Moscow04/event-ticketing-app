import * as bookingService from '../services/bookingService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const createBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.createNewBooking(req.user.id, req.validatedBody);
  res.status(201).json({ success: true, data: booking });
});

export const listMyBookings = asyncHandler(async (req, res) => {
  const result = await bookingService.getUserBookingHistory(req.user.id, req.query);
  res.json({ success: true, ...result });
});

export const getBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.getBookingDetailsForUser(req.params.id, req.user.id);
  res.json({ success: true, data: booking });
});
