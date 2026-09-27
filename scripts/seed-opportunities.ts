// scripts/seed-opportunities.ts
//
// Run with: npx tsx scripts/seed-opportunities.ts
// (npm install -D tsx if you don't have it)
//
// Requires in .env.local:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   <- NOT the anon/publishable key. This script
//                                  writes data directly, bypassing RLS, so it
//                                  needs the service role key from
//                                  Settings > API > service_role in the
//                                  Supabase dashboard. Never expose this key
//                                  to the browser or commit it.
//
// No OPENAI_API_KEY or any other API key needed for embeddings — this runs
// the embedding model locally via @xenova/transformers. First run downloads
// the model (~90MB) and caches it; every run after that is fully offline.

import { createClient } from '@supabase/supabase-js'
import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Source: https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml
// This public page only lists name + broad expertise — it does not say
// whether a professor is currently taking students, what the time
// commitment looks like, or specific prerequisites. Those fields are left
// null here rather than guessed. Surface that honestly in the UI (e.g.
// "Contact the professor to confirm current availability") instead of
// implying you know something you don't. If you email a few professors
// directly later, fill in their real values and flip is_available as
// appropriate — everything below defaults to true only because the page
// doesn't say otherwise, not because it's confirmed.
const opportunities = [
  {
    professor_name: 'Dr. Abdelfattah Amamra',
    department: 'Computer Science',
    lab_name: null,
    research_areas: ['Android security', 'network security', 'malware analysis and detection', 'embedded system virtualization and security', 'anomaly detection', 'machine learning classifiers'],
    project_description:
      'Research spans Android security, network security, malware analysis and detection, embedded system virtualization and security, anomaly detection, and machine learning classifiers.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml'],
  },
  {
    professor_name: 'Dr. Tingting Chen',
    department: 'Computer Science',
    lab_name: null,
    research_areas: ['big data security and privacy', 'health informatics', 'cybersecurity'],
    project_description:
      'Research focuses on big data security and privacy, health informatics, and cybersecurity in general.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml'],
  },
  {
    professor_name: 'Dr. Mohammad Husain',
    department: 'Computer Science',
    lab_name: 'PolySec Lab',
    research_areas: ['systems and network security', 'digital forensics', 'smartphone security and social applications', 'power-aware secure computing'],
    project_description:
      'Runs the PolySec Lab. Research focuses on cognitive cybersecurity solutions drawing on psychology, physiology, and neuroscience, plus assessing and addressing security vulnerabilities in emerging technologies. The lab also covers digital forensics in embedded systems and cloud computing, smartphone security and social applications, and power-aware secure computing. CPP has been designated a National Center of Academic Excellence in Information Assurance/Cyber Defense, and the lab has held an NSF CyberCorps Scholarship for Service grant.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml', 'https://www.cpp.edu/sci/computer-science/student-labs/research-labs.shtml'],
  },
  {
    professor_name: 'Dr. Fatemeh Jamshidi',
    department: 'Computer Science',
    lab_name: 'IMMERSYNC Lab',
    research_areas: ['artificial intelligence', 'computer science education', 'computer music', 'machine learning and deep learning in music', 'game AI', 'game music', 'XR and mixed reality', 'large language models in music', 'human-AI cooperation'],
    project_description:
      'Runs the Immersive Synchronization Lab (IMMERSYNC), at the intersection of game development, game music, music therapy, and VR/MR/XR. Current work includes VR-based music learning systems, adaptive music therapy platforms, immersive game environments, real-time audio-visual synchronization tools, and collaborative rehearsal in XR spaces, including how generative AI can support students as music creators, game developers, and digital storytellers.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml', 'https://www.cpp.edu/sci/computer-science/student-labs/research-labs.shtml'],
  },
  {
    professor_name: 'Dr. Hao Ji',
    department: 'Computer Science',
    lab_name: 'Computational Intelligence Lab',
    research_areas: ['big data analysis', 'high performance computing', 'large-scale linear algebra', 'machine learning', 'computer vision'],
    project_description:
      'Runs the Computational Intelligence Lab, focused on efficient and scalable computational algorithms for machine learning and computer vision applications, and on data intelligence more broadly. The lab is equipped with a multi-camera array and depth sensors for capturing 3D image data, plus GPU workstations for data processing and mining, and gives students hands-on project experience.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml', 'https://www.cpp.edu/sci/computer-science/student-labs/research-labs.shtml'],
  },
  {
    professor_name: 'Dr. John Korah',
    department: 'Computer Science',
    lab_name: null,
    research_areas: ['parallel & distributed algorithm design', 'high performance computing', 'large & dynamic network analysis', 'computational social systems', 'cybersecurity', 'parallel/distributed information retrieval', 'modeling & simulation'],
    project_description:
      'Research covers parallel and distributed algorithm design, high performance computing, large and dynamic network analysis, computational social systems, cybersecurity, parallel/distributed information retrieval, and modeling and simulation.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml'],
  },
  {
    professor_name: 'Dr. Ericsson Santana Marin',
    department: 'Computer Science',
    lab_name: 'CALSys Lab',
    research_areas: ['cyber-threat intelligence', 'social network analysis', 'network science', 'machine learning', 'data mining', 'artificial intelligence'],
    project_description:
      'Runs the Cyber Adaptive Learning Systems Lab (CALSys), working on proactive cyber-threat intelligence by combining machine learning, social network analysis, and cybersecurity. Activities include mining and classifying data to identify key hackers, extract hacker network topology, predict software vulnerability exploitation, detect 0-day exploits, and anticipate malicious viral cascades.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml', 'https://www.cpp.edu/sci/computer-science/student-labs/research-labs.shtml', 'https://www.cpp.edu/calsys/index.shtml'],
  },
  {
    professor_name: 'Dr. Amar Raheja',
    department: 'Computer Science',
    lab_name: null,
    research_areas: ['image processing', 'computer vision', 'machine learning', 'multidimensional data analysis and visualization', 'applied AI (biomedical, agriculture, controls, geology)'],
    project_description:
      'Research focuses on image processing, computer vision, machine learning, multidimensional data analysis and visualization, and applied AI in biomedical, agriculture, controls, and geology domains.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml'],
  },
  {
    professor_name: 'Dr. Brianna Posadas',
    department: 'Computer Science',
    lab_name: null,
    research_areas: ['human-computer interaction', 'user-centered design and technology adoption', 'usable security', 'accessibility and inclusive design', 'applied computing in agriculture', 'data science and big data analysis', 'remote sensing (UAVs)', 'computing education'],
    project_description:
      'Research spans human-computer interaction, user-centered design and technology adoption, usable security, accessibility and inclusive design, applied computing in agriculture and other real-world domains, data science and big data analysis, remote sensing with UAVs, and computing education.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml'],
  },
  {
    professor_name: 'Dr. Salam Salloum',
    department: 'Computer Science',
    lab_name: null,
    research_areas: ['fault tolerant computing', 'computer architecture', 'algorithm design', 'software engineering', 'database theory & design', 'information security'],
    project_description:
      'Research covers fault tolerant computing, computer architecture (arithmetic, sorting networks, interconnection networks), algorithm design, software engineering, database theory and design, and information security.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml'],
  },
  {
    professor_name: 'Dr. Wendy Shi',
    department: 'Computer Science',
    lab_name: null,
    research_areas: ['human-computer interaction', 'computing education', 'collaborative and social computing', 'learning analytics', 'educational data mining', 'AI in education', 'data visualization', 'future of work'],
    project_description:
      'Research spans human-computer interaction, computing education, collaborative and social computing, learning analytics, educational data mining, AI in education, data visualization, and the future of work.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml'],
  },
  {
    professor_name: 'Dr. Ben Steichen',
    department: 'Computer Science',
    lab_name: 'HAPII Lab',
    research_areas: ['human-centered computing', 'personalization', 'adaptive information retrieval & visualization', 'web & data science', 'multilingualism'],
    project_description:
      'Runs the Human-centered, Adaptive, and Personalized Information Interaction (HAPII) Lab, which builds solutions to understand and support individual users through personalization, applied to personalized web search, adaptive information visualization, and intelligent user interfaces. The lab uses eye trackers and other physiological sensors for usability and user-experience research.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml', 'https://www.cpp.edu/sci/computer-science/student-labs/research-labs.shtml'],
  },
  {
    professor_name: 'Dr. Yu Sun',
    department: 'Computer Science',
    lab_name: null,
    research_areas: ['software engineering', 'cloud computing', 'mobile computing', 'software entrepreneurship'],
    project_description:
      'Research covers software engineering, cloud computing, mobile computing, and software entrepreneurship.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml'],
  },
  {
    professor_name: 'Dr. Daisy Tang',
    department: 'Computer Science',
    lab_name: 'Intelligent Robotics Lab',
    research_areas: ['robotics', 'AI', 'human-robot interaction', 'machine learning', 'multi-agent systems', 'educational robotics'],
    project_description:
      'Runs the Intelligent Robotics Lab, focused on multi-robot systems, unmanned systems, machine learning, and educational robotics. The lab is equipped with LEGO Mindstorms EV3 robots and iRobot Create platforms with lidar and camera sensors, used for both research and teaching, including outreach at summer camps.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml', 'https://www.cpp.edu/sci/computer-science/student-labs/research-labs.shtml'],
  },
  {
    professor_name: 'Dr. Yunsheng Wang',
    department: 'Computer Science',
    lab_name: null,
    research_areas: ['wireless networks and mobile computing', 'AIoT', 'connected and autonomous vehicles', 'edge computing', 'cybersecurity'],
    project_description:
      'Research focuses on wireless networks and mobile computing, AIoT, connected and autonomous vehicles, edge computing, and cybersecurity.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml'],
  },
  {
    professor_name: 'Dr. Mingyan Xiao',
    department: 'Computer Science',
    lab_name: null,
    research_areas: ['privacy preserving', 'mobile crowdsourcing', 'system security'],
    project_description:
      'Research covers privacy-preserving techniques, mobile crowdsourcing, and system security.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml'],
  },
  {
    professor_name: 'Dr. Lan Yang',
    department: 'Computer Science',
    lab_name: null,
    research_areas: ['big data analytics', 'cloud computing', 'web-based software development', 'parallel and distributed computing', 'computer architecture'],
    project_description:
      'Research spans big data analytics, cloud computing, web-based software development, parallel and distributed computing, and computer architecture.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml'],
  },
  {
    professor_name: 'Dr. G. S. Young',
    department: 'Computer Science',
    lab_name: null,
    research_areas: ['parallel and distributed computing', 'computer networks', 'parallel computer architecture', 'supercomputing', 'scheduling', 'combinatorial optimization'],
    project_description:
      'Research covers parallel and distributed computing, computer networks, parallel computer architecture, supercomputing, scheduling, and combinatorial optimization.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/faculty-and-staff/faculty-research-int.shtml'],
  },
  {
    // Not on the faculty expertise page as of this writing — found only via
    // the research labs page. Worth double-checking this professor is
    // actually current CS faculty before treating this as fully reliable.
    professor_name: 'Dr. Kosaraju',
    department: 'Computer Science',
    lab_name: 'AI&ML-X Lab',
    research_areas: ['generative AI', 'trustworthy machine learning', 'data-driven solutions for healthcare, agriculture, and life sciences', 'precision agriculture', 'bioinformatics', 'drug discovery', 'medical imaging'],
    project_description:
      'Runs the AI&ML-X Lab (Artificial Intelligence and Machine Learning for the Real World), interdisciplinary research advancing generative AI, trustworthy machine learning, and data-driven solutions for healthcare, agriculture, and life sciences. Current student projects span precision agriculture, bioinformatics, drug discovery, and medical imaging, with mentorship, research training, and industry partnerships.',
    desired_skills: [],
    prerequisites: null,
    time_commitment_hours: null,
    is_available: true,
    preferred_contact_method: 'email',
    public_resources: ['https://www.cpp.edu/sci/computer-science/student-labs/research-labs.shtml'],
  },
]

// Loading the model is slow (a few seconds) but only needs to happen once
// per script run, not once per professor — load it, then reuse it in the loop.
let embedder: FeatureExtractionPipeline | null = null

async function embed(text: string): Promise<number[]> {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }
  // `pooling: 'mean'` and `normalize: true` are what turn per-token vectors
  // into one fixed-length (384) vector per input text, normalized so cosine
  // similarity behaves correctly later.
  const output = await embedder(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}

function toEmbeddingText(o: (typeof opportunities)[number]): string {
  // What gets embedded matters as much as the model — this concatenation is
  // what "similarity" will actually be computed against, so make sure it
  // captures the substance of the opportunity, not just its title.
  const lines = [o.project_description, `Research areas: ${o.research_areas.join(', ')}`]
  if (o.desired_skills.length > 0) {
    lines.push(`Desired skills: ${o.desired_skills.join(', ')}`)
  }
  return lines.join('\n')
}

async function main() {
  for (const o of opportunities) {
    const embedding = await embed(toEmbeddingText(o))

    const { error } = await supabase.from('opportunities').insert({
      ...o,
      opportunity_embedding: embedding,
    })

    if (error) {
      console.error(`Failed to insert ${o.professor_name}:`, error.message)
    } else {
      console.log(`Inserted ${o.professor_name}`)
    }
  }
}

main()