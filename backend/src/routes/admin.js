import { Router } from 'express';
import { getAllEvents, getAllBookings, toggleEventStatus } from '../controllers/adminController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/events', getAllEvents);
router.patch('/events/:id/toggle-status', toggleEventStatus);
router.get('/bookings', getAllBookings);

export default router;
