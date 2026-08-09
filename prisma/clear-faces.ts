import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
const adapter = new PrismaPg({
  connectionString,
  max: 3,
  connectionTimeoutMillis: 60000,
  idleTimeoutMillis: 60000,
})

const prisma = new PrismaClient({
  adapter,
  log: ['warn', 'error'],
})

async function main() {
  const result = await prisma.student.updateMany({
    data: {
      faceDescriptor: Prisma.DbNull,
      faceImage: null,
      faceDescriptorQuality: null,
    },
  })
  console.log(`Cleared face data for ${result.count} students.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
