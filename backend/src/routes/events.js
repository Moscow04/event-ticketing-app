import { Router } from 'express';
import { createEvent, listEvents, getEvent, updateEvent } from '../controllers/eventController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.get('/', listEvents);
router.get('/:id', getEvent);
router.post('/', authenticate, validate(schemas.createEvent), createEvent);
router.patch('/:id', authenticate, validate(schemas.updateEvent), updateEvent);

export default router;
