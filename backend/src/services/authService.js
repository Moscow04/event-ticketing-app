import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { createUser, findUserByEmail, findUserById } from '../models/index.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';

export async function registerUser({ name, email, password }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser({ name, email, passwordHash });

  const token = generateToken(user);
  return { user, token };
}

export async function loginUser({ email, password }) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = generateToken(user);
  const { password_hash, ...safeUser } = user;
  return { user: safeUser, token };
}

export async function getProfile(userId) {
  const user = await findUserById(userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  return user;
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}
