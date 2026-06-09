import { NextRequest, NextResponse } from 'next/server';
import { createChatCompletion } from '@/lib/openrouter';
import { db } from '@/lib/db';

const BASE_SYSTEM_PROMPT = `You are CEH AI, the official AI assistant for ClearPath Edu Hub's End of Year / Graduation Ceremony. You are knowledgeable, friendly, and professional.

Key Information:
- Institution: ClearPath Edu Hub
- Event: End of Year / Graduation Ceremony 2026
- Motto: "Consciousness • Competence • Character"
- Director: Odebunmi Tawwāb
- Built by: ClearPath students

You help guests and students with:
- Event information and schedule
- General knowledge questions
- Career and educational guidance
- Cybersecurity knowledge
- Information about registered students (names, departments)
- Attendance records and statistics
- Quiz performance and leaderboard data
- Fun facts and conversation
- ClearPath Edu Hub programs

Use the school context provided below whenever available. Be enthusiastic about the graduation ceremony! Keep responses concise but informative. Use warm, celebratory language appropriate for a graduation event.`;

async function buildFullSystemPrompt(schoolContext?: {
  students?: any[];
  settings?: Record<string, string>;
  attendanceCount?: number;
  leaderboard?: any[];
}) {
  let prompt = BASE_SYSTEM_PROMPT;

  // Add school knowledge base (admin-trained info)
  try {
    const schoolInfo = await db.schoolInfo.findMany();
    if (schoolInfo.length > 0) {
      prompt += '\n\n--- SCHOOL KNOWLEDGE BASE (Admin-provided info) ---\n';
      const grouped: Record<string, typeof schoolInfo> = {};
      for (const item of schoolInfo) {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
      }
      for (const [category, items] of Object.entries(grouped)) {
        prompt += `\n[${category.toUpperCase()}]\n`;
        for (const item of items) {
          prompt += `${item.title}: ${item.content}\n`;
        }
      }
      prompt += '\n--- END SCHOOL KNOWLEDGE BASE ---\n';
    }
  } catch {}

  // Add dynamic school context (students, attendance, etc.)
  if (schoolContext) {
    prompt += '\n\n--- CURRENT SCHOOL DATA ---\n';

    if (schoolContext.students?.length) {
      prompt += `\nRegistered Students (${schoolContext.students.length}):\n`;
      schoolContext.students.slice(0, 50).forEach((s: any) => {
        prompt += `- ${s.name} (${s.department}, ${s.email})\n`;
      });
    }

    if (schoolContext.settings) {
      const { avatarUrl, adminPin, ...rest } = schoolContext.settings;
      if (Object.keys(rest).length > 0) {
        prompt += `\nSettings:\n`;
        Object.entries(rest).forEach(([k, v]) => { prompt += `- ${k}: ${v}\n`; });
      }
    }

    if (schoolContext.attendanceCount !== undefined) {
      prompt += `\nTotal Attendance Records: ${schoolContext.attendanceCount}\n`;
    }

    if (schoolContext.leaderboard?.length) {
      prompt += `\nTop Quiz Performers:\n`;
      schoolContext.leaderboard.slice(0, 10).forEach((entry: any, i: number) => {
        prompt += `- #${i + 1}: ${entry.studentName} - ${entry.percentage}% (${entry.score}/${entry.total})\n`;
      });
    }

    prompt += '\n--- END SCHOOL DATA ---\n';
  }

  prompt += '\nAlways use the above context when answering. If asked about something not in the context, say you don\'t have that information.';
  return prompt;
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [], schoolContext } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const systemPrompt = await buildFullSystemPrompt(schoolContext);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.slice(-10),
      { role: 'user' as const, content: message },
    ];

    const reply = await createChatCompletion(messages, {
      temperature: 0.7,
      max_tokens: 600,
    });

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      reply: "I'm having a momentary issue connecting. Please try again shortly!"
    }, { status: 500 });
  }
}
