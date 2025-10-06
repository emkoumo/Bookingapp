import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking database...\n')

  const businesses = await prisma.business.findMany({
    include: {
      properties: true,
      emailTemplates: true,
    },
  })

  console.log('✅ Businesses:', businesses.length)
  businesses.forEach((business) => {
    console.log(`   - ${business.name}`)
    console.log(`     Email: ${business.email}`)
    console.log(`     Properties: ${business.properties.length}`)
    business.properties.forEach((prop) => {
      console.log(`       • ${prop.name}`)
    })
    console.log(`     Email Templates: ${business.emailTemplates.length}`)
  })

  console.log('\n✅ Database connection successful!')
  console.log('\n📊 Summary:')
  console.log(`   Total Businesses: ${businesses.length}`)
  console.log(`   Total Properties: ${businesses.reduce((sum, b) => sum + b.properties.length, 0)}`)
  console.log(`   Total Email Templates: ${businesses.reduce((sum, b) => sum + b.emailTemplates.length, 0)}`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
