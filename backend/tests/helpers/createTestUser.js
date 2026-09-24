// Test fixture: creates a user directly in the database and mints a JWT,
// bypassing the bcrypt cost of the real register/login endpoints (~100 ms per
// hash/compare in bcryptjs). It mirrors what `register` does — user row plus
// default finance categories — so suites that assert on the defaults behave the
// same. Coverage of the auth endpoints themselves lives in `auth.test.js`.
import jwt from 'jsonwebtoken';
import prisma from '../../src/config/database.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../../src/config.js';
import { ensureDefaultCategories } from '../../src/utils/financeDefaults.js';

const uniqueUsername = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const createTestUser = async (prefix = 'test_user') => {
  const user = await prisma.user.create({
    data: { username: uniqueUsername(prefix), password: 'test-hash' },
  });

  await ensureDefaultCategories(user.id, prisma);

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  return { user, token };
};

export { createTestUser };
