const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminUsername = 'admin';
  const adminPassword = 'admin123'; // Change in production

  // Check if admin user already exists
  const existingUser = await prisma.user.findUnique({
    where: { username: adminUsername }
  });

  if (existingUser) {
    console.log('Admin user already exists');
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Create admin user
  await prisma.user.create({
    data: {
      username: adminUsername,
      password: hashedPassword
    }
  });

  console.log('Admin user created successfully');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });