import { Router } from 'express';
import { createBooking, listMyBookings, getBooking } from '../controllers/bookingController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.use(authenticate);
router.post('/', validate(schemas.createBooking), createBooking);
router.get('/', listMyBookings);
router.get('/:id', getBooking);

export default router;
