export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correct: number;
  category: string;
}

export const quizQuestions: QuizQuestion[] = [
  // Cybersecurity Fundamentals (1-16)
  { id: 1, question: "What does CIA triad stand for in cybersecurity?", options: ["Central Intelligence Agency", "Confidentiality, Integrity, Availability", "Cryptographic Identity Authentication", "Cyber Incident Analysis"], correct: 1, category: "Cybersecurity Fundamentals" },
  { id: 2, question: "Which type of hacker works to improve security by finding vulnerabilities?", options: ["Black Hat", "Grey Hat", "White Hat", "Script Kiddie"], correct: 2, category: "Cybersecurity Fundamentals" },
  { id: 3, question: "What is phishing?", options: ["A network protocol", "A social engineering attack via deceptive messages", "A type of firewall", "A password cracking tool"], correct: 1, category: "Cybersecurity Fundamentals" },
  { id: 4, question: "What is the principle of least privilege?", options: ["Give maximum access to all users", "Give only minimum access needed for a task", "Give admin rights to everyone", "Restrict internet access only"], correct: 1, category: "Cybersecurity Fundamentals" },
  { id: 5, question: "Which protocol is considered secure for web browsing?", options: ["HTTP", "FTP", "HTTPS", "Telnet"], correct: 2, category: "Cybersecurity Fundamentals" },
  { id: 6, question: "What is a zero-day vulnerability?", options: ["A bug found on January 1st", "A vulnerability unknown to the vendor with no patch", "A vulnerability in day-zero systems", "An expired SSL certificate"], correct: 1, category: "Cybersecurity Fundamentals" },
  { id: 7, question: "What is malware?", options: ["Hardware failure", "Malicious software designed to harm", "A type of antivirus", "A network cable"], correct: 1, category: "Cybersecurity Fundamentals" },
  { id: 8, question: "What does VPN stand for?", options: ["Virtual Private Network", "Very Protected Network", "Visual Processing Node", "Virtual Protocol Network"], correct: 0, category: "Cybersecurity Fundamentals" },
  { id: 9, question: "Which of these is NOT a type of malware?", options: ["Virus", "Worm", "Firewall", "Trojan"], correct: 2, category: "Cybersecurity Fundamentals" },
  { id: 10, question: "What is two-factor authentication (2FA)?", options: ["Using two passwords", "Verifying identity with two different methods", "Logging in from two devices", "Having two user accounts"], correct: 1, category: "Cybersecurity Fundamentals" },
  { id: 11, question: "What is a DDoS attack?", options: ["Data Deletion of System", "Overwhelming a server with traffic from multiple sources", "Decrypting passwords", "A database optimization technique"], correct: 1, category: "Cybersecurity Fundamentals" },
  { id: 12, question: "What is encryption?", options: ["Deleting data permanently", "Converting data into unreadable format using keys", "Compressing files", "Copying data to backup"], correct: 1, category: "Cybersecurity Fundamentals" },
  { id: 13, question: "What is a firewall?", options: ["A physical wall around servers", "A network security system that monitors traffic", "A type of virus", "A heating system for data centers"], correct: 1, category: "Cybersecurity Fundamentals" },
  { id: 14, question: "Which of the following is the strongest password?", options: ["password123", "MyDogMax", "Tr0ub4dor&3!", "qwerty"], correct: 2, category: "Cybersecurity Fundamentals" },
  { id: 15, question: "What is social engineering in cybersecurity?", options: ["Engineering social media platforms", "Manipulating people to divulge confidential info", "Building secure social networks", "Programming social apps"], correct: 1, category: "Cybersecurity Fundamentals" },
  { id: 16, question: "What is an IDS?", options: ["Intrusion Detection System", "Internal Data Storage", "Internet Download Service", "Identity Document System"], correct: 0, category: "Cybersecurity Fundamentals" },

  // Network Security (17-32)
  { id: 17, question: "What is the default port for HTTPS?", options: ["80", "443", "8080", "22"], correct: 1, category: "Network Security" },
  { id: 18, question: "What is a MAC address?", options: ["A Apple computer address", "A unique hardware identifier for network devices", "A type of IP address", "A media access code"], correct: 1, category: "Network Security" },
  { id: 19, question: "What does DNS do?", options: ["Encrypts web traffic", "Translates domain names to IP addresses", "Manages database queries", "Controls display settings"], correct: 1, category: "Network Security" },
  { id: 20, question: "What is a subnet mask?", options: ["A mask to hide your face online", "Defines network and host portions of an IP address", "A type of firewall", "An encryption key"], correct: 1, category: "Network Security" },
  { id: 21, question: "What protocol is used for secure remote shell access?", options: ["Telnet", "SSH", "FTP", "HTTP"], correct: 1, category: "Network Security" },
  { id: 22, question: "What is ARP spoofing?", options: ["Changing router passwords", "Sending fake ARP messages to link attacker's MAC with victim's IP", "Encrypting ARP packets", "Blocking ARP requests"], correct: 1, category: "Network Security" },
  { id: 23, question: "What is a VLAN?", options: ["Virtual Local Area Network", "Very Large Area Network", "Virtual LAN Adapter", "Voice LAN Network"], correct: 0, category: "Network Security" },
  { id: 24, question: "What is port scanning used for?", options: ["Scanning documents", "Discovering open ports on a target system", "Opening network ports", "Speed testing connections"], correct: 1, category: "Network Security" },
  { id: 25, question: "What is a DMZ in networking?", options: ["A gaming zone", "Demilitarized Zone - isolated network segment", "A DNS management zone", "Data Management Zone"], correct: 1, category: "Network Security" },
  { id: 26, question: "What is TCP SYN flood attack?", options: ["Sending many SYN packets to exhaust server resources", "Flood of TCP acknowledgments", "A type of database attack", "Overloading CPU with TCP calculations"], correct: 0, category: "Network Security" },
  { id: 27, question: "What does NAT stand for?", options: ["Network Address Translation", "New Authentication Technology", "Network Access Token", "Node Authorization Table"], correct: 0, category: "Network Security" },
  { id: 28, question: "What is an IPS?", options: ["Internet Protocol Security", "Intrusion Prevention System", "Internal Processing System", "Identity Protection Service"], correct: 1, category: "Network Security" },
  { id: 29, question: "What is packet sniffing?", options: ["Smelling network cables", "Capturing and analyzing network traffic", "Sending fake packets", "Blocking network packets"], correct: 1, category: "Network Security" },
  { id: 30, question: "What is a man-in-the-middle attack?", options: ["Attacking people physically", "Intercepting communication between two parties", "Hacking middle management", "Attacking mid-sized networks"], correct: 1, category: "Network Security" },
  { id: 31, question: "What is the purpose of an SSL/TLS certificate?", options: ["To speed up websites", "To authenticate and encrypt web communications", "To store passwords", "To block ads"], correct: 1, category: "Network Security" },
  { id: 32, question: "What is a rogue access point?", options: ["An authorized Wi-Fi hotspot", "An unauthorized wireless access point", "A backup router", "A type of antenna"], correct: 1, category: "Network Security" },

  // Ethical Hacking (33-48)
  { id: 33, question: "What is footprinting in ethical hacking?", options: ["Collecting information about a target before attacking", "Leaving footprints in logs", "Walking through a server room", "Creating a footprint file"], correct: 0, category: "Ethical Hacking" },
  { id: 34, question: "Which tool is commonly used for network scanning?", options: ["Photoshop", "Nmap", "Excel", "Word"], correct: 1, category: "Ethical Hacking" },
  { id: 35, question: "What is enumeration in hacking?", options: ["Counting numbers", "Extracting user names, machine names, and network resources", "Listing files alphabetically", "Creating numbered accounts"], correct: 1, category: "Ethical Hacking" },
  { id: 36, question: "What is a brute force attack?", options: ["A physical attack on hardware", "Trying every possible combination to crack a password", "Using a single password for all accounts", "A type of social engineering"], correct: 1, category: "Ethical Hacking" },
  { id: 37, question: "What is SQL injection?", options: ["Injecting SQL databases", "Inserting malicious SQL code into input fields", "A way to speed up queries", "A database backup method"], correct: 1, category: "Ethical Hacking" },
  { id: 38, question: "What is Metasploit?", options: ["A programming language", "A penetration testing framework", "An antivirus software", "A web browser"], correct: 1, category: "Ethical Hacking" },
  { id: 39, question: "What is a rootkit?", options: ["A set of basic system tools", "Malware designed to hide its presence and gain root access", "A type of router", "A kernel update"], correct: 1, category: "Ethical Hacking" },
  { id: 40, question: "What is session hijacking?", options: ["Taking over a user's active session", "Creating new sessions", "Closing sessions", "Logging out users"], correct: 0, category: "Ethical Hacking" },
  { id: 41, question: "What is privilege escalation?", options: ["Getting a promotion at work", "Gaining elevated access beyond authorized level", "Escalating a support ticket", "Improving system performance"], correct: 1, category: "Ethical Hacking" },
  { id: 42, question: "What is a backdoor?", options: ["A rear entrance to a building", "A hidden method to bypass security", "A backup door", "A secure tunnel"], correct: 1, category: "Ethical Hacking" },
  { id: 43, question: "What is payload in hacking?", options: ["Cargo data", "The malicious code delivered by an exploit", "A type of malware", "Network data"], correct: 1, category: "Ethical Hacking" },
  { id: 44, question: "What is Wireshark used for?", options: ["Wireless sharing", "Network protocol analysis and packet capture", "Wireless security", "Website development"], correct: 1, category: "Ethical Hacking" },
  { id: 45, question: "What is a cross-site scripting (XSS) attack?", options: ["Attacking across multiple sites", "Injecting malicious scripts into web pages viewed by others", "Cross-referencing site data", "A CSS styling attack"], correct: 1, category: "Ethical Hacking" },
  { id: 46, question: "What is banner grabbing?", options: ["Collecting promotional banners", "Extracting service version information", "Downloading website banners", "Creating graphical headers"], correct: 1, category: "Ethical Hacking" },
  { id: 47, question: "What is a rainbow table?", options: ["A colorful data chart", "Precomputed table for cracking password hashes", "A network topology map", "A type of cipher"], correct: 1, category: "Ethical Hacking" },
  { id: 48, question: "What is steganography?", options: ["Study of fossils", "Hiding data within other files like images", "A type of virus", "Data compression"], correct: 1, category: "Ethical Hacking" },

  // Cryptography (49-64)
  { id: 49, question: "What is the difference between symmetric and asymmetric encryption?", options: ["They are the same", "Symmetric uses one key; asymmetric uses a key pair", "Symmetric is slower", "Asymmetric is less secure"], correct: 1, category: "Cryptography" },
  { id: 50, question: "What is a hash function?", options: ["A cooking technique", "A function that maps data to a fixed-size digest", "A type of network", "A database table type"], correct: 1, category: "Cryptography" },
  { id: 51, question: "Which algorithm is commonly used for asymmetric encryption?", options: ["AES", "RSA", "DES", "3DES"], correct: 1, category: "Cryptography" },
  { id: 52, question: "What is a digital signature?", options: ["A handwritten signature online", "Cryptographic proof of authenticity and integrity", "A type of certificate", "An email signature"], correct: 1, category: "Cryptography" },
  { id: 53, question: "What is public key infrastructure (PKI)?", options: ["A public database", "Framework for managing digital certificates and encryption keys", "A public Wi-Fi system", "A type of firewall"], correct: 1, category: "Cryptography" },
  { id: 54, question: "What does AES stand for?", options: ["Advanced Encryption Standard", "Automated Email System", "Application Environment Setup", "Audio Encoding Standard"], correct: 0, category: "Cryptography" },
  { id: 55, question: "What is a certificate authority (CA)?", options: ["A certifying accountant", "An entity that issues digital certificates", "A type of court", "A credential agency"], correct: 1, category: "Cryptography" },
  { id: 56, question: "What is salting in password security?", options: ["Adding physical salt to hardware", "Adding random data before hashing a password", "Encrypting passwords twice", "Storing passwords in salt form"], correct: 1, category: "Cryptography" },
  { id: 57, question: "What key size does AES-256 use?", options: ["128 bits", "192 bits", "256 bits", "512 bits"], correct: 2, category: "Cryptography" },
  { id: 58, question: "What is a ciphertext?", options: ["A type of text format", "Encrypted unreadable text", "Plain readable text", "A coding language"], correct: 1, category: "Cryptography" },
  { id: 59, question: "What is key exchange in cryptography?", options: ["Swapping physical keys", "Securely sharing encryption keys between parties", "Changing passwords", "Exchanging public data"], correct: 1, category: "Cryptography" },
  { id: 60, question: "What is Diffie-Hellman key exchange used for?", options: ["Encrypting large files", "Securely exchanging cryptographic keys over public channels", "Digital signatures", "Hash generation"], correct: 1, category: "Cryptography" },
  { id: 61, question: "What is a one-time pad?", options: ["A disposable notebook", "An encryption technique using a random key used only once", "A temporary password", "A single-use token"], correct: 1, category: "Cryptography" },
  { id: 62, question: "What is MD5?", options: ["A medical device", "A hash function that produces 128-bit digest", "A programming language", "A network protocol"], correct: 1, category: "Cryptography" },
  { id: 63, question: "Why is MD5 considered insecure for passwords?", options: ["It's too slow", "It's vulnerable to collision attacks", "It produces too long hashes", "It's too complex"], correct: 1, category: "Cryptography" },
  { id: 64, question: "What is elliptic curve cryptography (ECC)?", options: ["Cryptography using curved shapes", "Public-key cryptography based on elliptic curve theory", "A type of symmetric encryption", "A hash algorithm"], correct: 1, category: "Cryptography" },

  // General Tech & ClearPath (65-80)
  { id: 65, question: "What is the motto of ClearPath Edu Hub?", options: ["Learn and Grow", "Consciousness, Competence, Character", "Education for All", "Path to Success"], correct: 1, category: "General Tech & ClearPath" },
  { id: 66, question: "What does CEH stand for?", options: ["Certified Ethical Hacker", "Computer Engineering Hub", "Central Education Hub", "Cybersecurity Expert Handbook"], correct: 0, category: "General Tech & ClearPath" },
  { id: 67, question: "What is cloud computing?", options: ["Computing in the clouds", "Delivering computing services over the internet", "Weather simulation", "Air traffic control system"], correct: 1, category: "General Tech & ClearPath" },
  { id: 68, question: "What is IoT?", options: ["Internet of Things", "Integration of Technology", "Internet over Telephone", "Internal Object Transfer"], correct: 0, category: "General Tech & ClearPath" },
  { id: 69, question: "What is ransomware?", options: ["Software for managing ransoms", "Malware that encrypts files and demands payment", "A type of firewall", "An encryption tool"], correct: 1, category: "General Tech & ClearPath" },
  { id: 70, question: "What does OSINT stand for?", options: ["Open Source Intelligence", "Operating System Integration", "Online Security Integration", "Open System Interface"], correct: 0, category: "General Tech & ClearPath" },
  { id: 71, question: "What is a vulnerability assessment?", options: ["Assessing employee weaknesses", "Identifying and quantifying security vulnerabilities", "Testing software performance", "Evaluating network speed"], correct: 1, category: "General Tech & ClearPath" },
  { id: 72, question: "What is incident response?", options: ["Responding to emails", "An organized approach to addressing security incidents", "A customer service system", "A bug tracking tool"], correct: 1, category: "General Tech & ClearPath" },
  { id: 73, question: "What is a SIEM system?", options: ["Security Information and Event Management", "System Integration Error Management", "Secure Internet Email Manager", "Software Implementation Environment"], correct: 0, category: "General Tech & ClearPath" },
  { id: 74, question: "What is the CIA triad essential for?", options: ["Spy agencies", "Information security objectives", "Military operations", "Data storage"], correct: 1, category: "General Tech & ClearPath" },
  { id: 75, question: "What is a security policy?", options: ["Insurance policy for security", "A document defining rules for protecting information assets", "A government law", "A software license"], correct: 1, category: "General Tech & ClearPath" },
  { id: 76, question: "What is a penetration test?", options: ["Testing pen quality", "Authorized simulated cyberattack to evaluate security", "A type of virus scan", "Network speed test"], correct: 1, category: "General Tech & ClearPath" },
  { id: 77, question: "What is blockchain technology?", options: ["A chain of blocks in construction", "Distributed ledger technology for secure transactions", "A database query language", "A type of malware"], correct: 1, category: "General Tech & ClearPath" },
  { id: 78, question: "What is multi-factor authentication?", options: ["Using multiple passwords", "Requiring two or more verification factors", "Having multiple accounts", "Using multiple devices"], correct: 1, category: "General Tech & ClearPath" },
  { id: 79, question: "What is the primary goal of cybersecurity?", options: ["To make money", "To protect systems, networks, and data from attacks", "To hack systems", "To monitor employees"], correct: 1, category: "General Tech & ClearPath" },
  { id: 80, question: "Who directed the ClearPath Edu Hub graduation ceremony project?", options: ["Unknown", "Odebunmi Tawwāb", "A private contractor", "Students only"], correct: 1, category: "General Tech & ClearPath" },
];

export const quizCategories = [
  "Cybersecurity Fundamentals",
  "Network Security",
  "Ethical Hacking",
  "Cryptography",
  "General Tech & ClearPath",
];
