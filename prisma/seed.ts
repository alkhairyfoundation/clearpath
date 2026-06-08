import { PrismaClient } from '@prisma/client'

const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } },
})

async function main() {
  console.log('🌱 Seeding CEH AI database...')

  // Clear existing data
  console.log('  🗑️  Clearing existing data...')
  await prisma.attendance.deleteMany()
  await prisma.quizSession.deleteMany()
  await prisma.student.deleteMany()

  console.log('  ✅ Database cleared. Ready for fresh registrations.')

  // Create default app setting
  await prisma.appSetting.upsert({
    where: { key: 'appName' },
    update: { value: 'CEH AI - ClearPath Edu Hub' },
    create: { key: 'appName', value: 'CEH AI - ClearPath Edu Hub' },
  })

  console.log('🎉 Seed complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
