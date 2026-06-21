import { z } from 'zod';
import { ValidationError } from '../utils/errors.js';

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new ValidationError(message);
    }
    req.validatedBody = result.data;
    next();
  };
}

export const schemas = {
  register: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email().max(255),
    password: z.string().min(8).max(128),
  }),
  login: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
  createEvent: z.object({
    title: z.string().min(3).max(200),
    description: z.string().min(10).max(5000),
    venue: z.string().min(3).max(300),
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
    category: z.enum(['concert', 'conference', 'workshop', 'sports', 'theatre', 'festival', 'other']),
    banner_url: z.string().url().optional(),
    ticket_types: z.array(z.object({
      name: z.string().min(1).max(100),
      price: z.number().positive(),
      quantity: z.number().int().positive(),
      description: z.string().max(500).optional(),
    })).min(1).max(10),
  }),
  updateEvent: z.object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(10).max(5000).optional(),
    venue: z.string().min(3).max(300).optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    category: z.enum(['concert', 'conference', 'workshop', 'sports', 'theatre', 'festival', 'other']).optional(),
    banner_url: z.string().url().optional(),
    status: z.enum(['draft', 'published', 'cancelled']).optional(),
  }),
  createBooking: z.object({
    event_id: z.string().uuid(),
    tickets: z.array(z.object({
      ticket_type_id: z.string().uuid(),
      quantity: z.number().int().positive(),
    })).min(1).max(10),
  }),
};
