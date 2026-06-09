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

  // Add default quiz sections for battle mode
  const existingSections = await prisma.quizSection.count()
  if (existingSections === 0) {
    console.log('  🎯 Adding default quiz sections...')

    const sections = [
      {
        name: 'Cryptography',
        description: 'Encryption, hashing, PKI, and key management',
        questions: [
          { question: 'What is the difference between symmetric and asymmetric encryption?', options: ['They are the same', 'Symmetric uses one key; asymmetric uses a key pair', 'Symmetric is slower', 'Asymmetric is less secure'], correct: 1, points: 10 },
          { question: 'Which algorithm is commonly used for asymmetric encryption?', options: ['AES', 'RSA', 'DES', '3DES'], correct: 1, points: 10 },
          { question: 'What does AES stand for?', options: ['Advanced Encryption Standard', 'Automated Email System', 'Application Environment Setup', 'Audio Encoding Standard'], correct: 0, points: 10 },
          { question: 'What is a hash function?', options: ['A cooking technique', 'A function that maps data to a fixed-size digest', 'A type of network', 'A database table type'], correct: 1, points: 10 },
          { question: 'What key size does AES-256 use?', options: ['128 bits', '192 bits', '256 bits', '512 bits'], correct: 2, points: 10 },
          { question: 'What is a digital signature?', options: ['A handwritten signature online', 'Cryptographic proof of authenticity and integrity', 'A type of certificate', 'An email signature'], correct: 1, points: 10 },
          { question: 'What is public key infrastructure (PKI)?', options: ['A public database', 'Framework for managing digital certificates and encryption keys', 'A public Wi-Fi system', 'A type of firewall'], correct: 1, points: 10 },
          { question: 'What is salting in password security?', options: ['Adding physical salt to hardware', 'Adding random data before hashing a password', 'Encrypting passwords twice', 'Storing passwords in salt form'], correct: 1, points: 10 },
          { question: 'What is a ciphertext?', options: ['A type of text format', 'Encrypted unreadable text', 'Plain readable text', 'A coding language'], correct: 1, points: 10 },
          { question: 'What is Diffie-Hellman key exchange used for?', options: ['Encrypting large files', 'Securely exchanging cryptographic keys over public channels', 'Digital signatures', 'Hash generation'], correct: 1, points: 10 },
        ],
      },
      {
        name: 'Network Security',
        description: 'Protocols, attacks, and defense mechanisms',
        questions: [
          { question: 'What is the default port for HTTPS?', options: ['80', '443', '8080', '22'], correct: 1, points: 10 },
          { question: 'What does DNS do?', options: ['Encrypts web traffic', 'Translates domain names to IP addresses', 'Manages database queries', 'Controls display settings'], correct: 1, points: 10 },
          { question: 'What is a firewall?', options: ['A physical wall around servers', 'A network security system that monitors traffic', 'A type of virus', 'A heating system for data centers'], correct: 1, points: 10 },
          { question: 'What is a DDoS attack?', options: ['Data Deletion of System', 'Overwhelming a server with traffic from multiple sources', 'Decrypting passwords', 'A database optimization technique'], correct: 1, points: 10 },
          { question: 'What protocol is used for secure remote shell access?', options: ['Telnet', 'SSH', 'FTP', 'HTTP'], correct: 1, points: 10 },
          { question: 'What is a man-in-the-middle attack?', options: ['Attacking people physically', 'Intercepting communication between two parties', 'Hacking middle management', 'Attacking mid-sized networks'], correct: 1, points: 10 },
          { question: 'What is ARP spoofing?', options: ['Changing router passwords', 'Sending fake ARP messages to link attacker MAC with victim IP', 'Encrypting ARP packets', 'Blocking ARP requests'], correct: 1, points: 10 },
          { question: 'What is port scanning used for?', options: ['Scanning documents', 'Discovering open ports on a target system', 'Opening network ports', 'Speed testing connections'], correct: 1, points: 10 },
          { question: 'What is a VLAN?', options: ['Virtual Local Area Network', 'Very Large Area Network', 'Virtual LAN Adapter', 'Voice LAN Network'], correct: 0, points: 10 },
          { question: 'What is an IPS?', options: ['Internet Protocol Security', 'Intrusion Prevention System', 'Internal Processing System', 'Identity Protection Service'], correct: 1, points: 10 },
        ],
      },
      {
        name: 'Ethical Hacking',
        description: 'Footprinting, enumeration, exploitation, and tools',
        questions: [
          { question: 'What is footprinting in ethical hacking?', options: ['Collecting information about a target before attacking', 'Leaving footprints in logs', 'Walking through a server room', 'Creating a footprint file'], correct: 0, points: 10 },
          { question: 'Which tool is commonly used for network scanning?', options: ['Photoshop', 'Nmap', 'Excel', 'Word'], correct: 1, points: 10 },
          { question: 'What is a brute force attack?', options: ['A physical attack on hardware', 'Trying every possible combination to crack a password', 'Using a single password for all accounts', 'A type of social engineering'], correct: 1, points: 10 },
          { question: 'What is SQL injection?', options: ['Injecting SQL databases', 'Inserting malicious SQL code into input fields', 'A way to speed up queries', 'A database backup method'], correct: 1, points: 10 },
          { question: 'What is Metasploit?', options: ['A programming language', 'A penetration testing framework', 'An antivirus software', 'A web browser'], correct: 1, points: 10 },
          { question: 'What is privilege escalation?', options: ['Getting a promotion at work', 'Gaining elevated access beyond authorized level', 'Escalating a support ticket', 'Improving system performance'], correct: 1, points: 10 },
          { question: 'What is a cross-site scripting (XSS) attack?', options: ['Attacking across multiple sites', 'Injecting malicious scripts into web pages viewed by others', 'Cross-referencing site data', 'A CSS styling attack'], correct: 1, points: 10 },
          { question: 'What is Wireshark used for?', options: ['Wireless sharing', 'Network protocol analysis and packet capture', 'Wireless security', 'Website development'], correct: 1, points: 10 },
          { question: 'What is session hijacking?', options: ['Taking over a users active session', 'Creating new sessions', 'Closing sessions', 'Logging out users'], correct: 0, points: 10 },
          { question: 'What is a rootkit?', options: ['A set of basic system tools', 'Malware designed to hide its presence and gain root access', 'A type of router', 'A kernel update'], correct: 1, points: 10 },
        ],
      },
    ]

    for (const section of sections) {
      await prisma.quizSection.create({
        data: {
          name: section.name,
          description: section.description,
          questions: {
            create: section.questions.map(q => ({
              question: q.question,
              options: q.options,
              correct: q.correct,
              points: q.points,
            })),
          },
        },
      })
      console.log(`  ✅ Added: ${section.name} (${section.questions.length} questions)`)
    }
  }

  console.log('🎉 Seed complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
