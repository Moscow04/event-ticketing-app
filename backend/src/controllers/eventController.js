import * as eventService from '../services/eventService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const createEvent = asyncHandler(async (req, res) => {
  const event = await eventService.createNewEvent(req.validatedBody, req.user.id);
  res.status(201).json({ success: true, data: event });
});

export const listEvents = asyncHandler(async (req, res) => {
  const result = await eventService.getAllPublishedEvents(req.query);
  res.json({ success: true, ...result });
});

export const getEvent = asyncHandler(async (req, res) => {
  const event = await eventService.getEventDetails(req.params.id);
  res.json({ success: true, data: event });
});

export const updateEvent = asyncHandler(async (req, res) => {
  const event = await eventService.updateExistingEvent(req.params.id, req.validatedBody, req.user.id);
  res.json({ success: true, data: event });
});
