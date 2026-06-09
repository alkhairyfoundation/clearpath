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

  // Add default school knowledge for AI training
  const existingInfo = await prisma.schoolInfo.count()
  if (existingInfo === 0) {
    console.log('  📚 Adding default school knowledge...')
    const defaultInfo = [
      {
        category: 'general',
        title: 'About ClearPath Edu Hub',
        content: 'ClearPath Edu Hub is an educational institution focused on cybersecurity, ethical hacking, and technology training. Our motto is "Consciousness • Competence • Character". The institution is directed by Odebunmi Tawwāb and was built by ClearPath students.',
      },
      {
        category: 'programs',
        title: 'Programs Offered',
        content: 'ClearPath Edu Hub offers programs in Cybersecurity, Network Engineering, Ethical Hacking, Cryptography, and General Technology. Students gain hands-on experience with industry-standard tools and techniques.',
      },
      {
        category: 'events',
        title: 'Graduation Ceremony 2026',
        content: 'The End of Year / Graduation Ceremony 2026 is a celebration of student achievements at ClearPath Edu Hub. Features include AI Assistant, Face Recognition Attendance, and Cybersecurity Quiz Challenge.',
      },
      {
        category: 'general',
        title: 'CEH AI Assistant',
        content: 'CEH AI is the official AI assistant for the ClearPath Edu Hub graduation ceremony. It can answer questions about the school, students, attendance, quiz results, cybersecurity topics, career guidance, and event information. It uses voice synthesis to speak responses when enabled.',
      },
      {
        category: 'policies',
        title: 'Attendance Policy',
        content: 'Students can mark their attendance using face recognition (automatic) or manual check-in. Each student can only mark attendance once per day. Attendance records are stored with timestamps.',
      },
    ]

    for (const info of defaultInfo) {
      await prisma.schoolInfo.create({ data: info })
      console.log(`  ✅ Added: ${info.title}`)
    }
  }

  console.log('🎉 Seed complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
