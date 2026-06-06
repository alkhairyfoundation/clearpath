import { PrismaClient } from '@prisma/client'

// Use direct URL for seeding to avoid pooler timeouts
const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } },
})

async function main() {
  console.log('🌱 Seeding CEH AI database...')

  // Check if data already exists
  const existingStudents = await prisma.student.count()
  if (existingStudents > 0) {
    console.log(`ℹ️  Database already has ${existingStudents} students. Skipping seed.`)
    return
  }

  // Create sample students
  const students = [
    { name: 'Adebayo Johnson', email: 'adebayo@clearpath.edu', department: 'Cybersecurity' },
    { name: 'Fatima Osei', email: 'fatima@clearpath.edu', department: 'Network Engineering' },
    { name: 'Emeka Nwankwo', email: 'emeka@clearpath.edu', department: 'Ethical Hacking' },
    { name: 'Amara Obi', email: 'amara@clearpath.edu', department: 'Cryptography' },
    { name: 'Kwame Asante', email: 'kwame@clearpath.edu', department: 'Cybersecurity Fundamentals' },
    { name: 'Zara Ibrahim', email: 'zara@clearpath.edu', department: 'Network Security' },
    { name: 'Tunde Bakare', email: 'tunde@clearpath.edu', department: 'Ethical Hacking' },
    { name: 'Chioma Eze', email: 'chioma@clearpath.edu', department: 'General Technology' },
  ]

  for (const student of students) {
    await prisma.student.create({ data: student })
    console.log(`  ✅ Registered: ${student.name}`)
  }

  // Create a default app setting
  await prisma.appSetting.upsert({
    where: { key: 'appName' },
    update: { value: 'CEH AI - ClearPath Edu Hub' },
    create: { key: 'appName', value: 'CEH AI - ClearPath Edu Hub' },
  })

  console.log(`\n🎉 Done! ${students.length} students registered.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
