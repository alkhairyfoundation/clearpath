import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

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

When asked about specific students or attendance data, use the school context provided below.
Be enthusiastic about the graduation ceremony! Keep responses concise but informative. Use warm, celebratory language appropriate for a graduation event.`;

function buildSystemPrompt(schoolContext?: {
  students?: any[];
  settings?: Record<string, string>;
  attendanceCount?: number;
  leaderboard?: any[];
}) {
  if (!schoolContext) return BASE_SYSTEM_PROMPT;

  let contextBlock = '\n\n--- CURRENT SCHOOL CONTEXT ---\n';

  if (schoolContext.students?.length) {
    contextBlock += `\nRegistered Students (${schoolContext.students.length} total):\n`;
    schoolContext.students.slice(0, 50).forEach(s => {
      contextBlock += `- ${s.name} (${s.department}, ${s.email})\n`;
    });
  }

  if (schoolContext.settings) {
    const { avatarUrl, adminPin, ...otherSettings } = schoolContext.settings;
    if (Object.keys(otherSettings).length > 0) {
      contextBlock += `\nSchool Settings:\n`;
      Object.entries(otherSettings).forEach(([k, v]) => {
        contextBlock += `- ${k}: ${v}\n`;
      });
    }
  }

  if (schoolContext.attendanceCount !== undefined) {
    contextBlock += `\nTotal Attendance Records: ${schoolContext.attendanceCount}\n`;
  }

  if (schoolContext.leaderboard?.length) {
    contextBlock += `\nTop Quiz Performers:\n`;
    schoolContext.leaderboard.slice(0, 10).forEach((entry, i) => {
      contextBlock += `- #${i + 1}: ${entry.studentName} - ${entry.percentage}% (${entry.score}/${entry.total})\n`;
    });
  }

  contextBlock += '\n--- END SCHOOL CONTEXT ---\n';
  contextBlock += '\nUse the above context when answering questions about students, attendance, or school data. If asked about something not in the context, say you don\'t have that information available.';

  return BASE_SYSTEM_PROMPT + contextBlock;
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [], schoolContext } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const zai = await ZAI.create();

    const systemPrompt = buildSystemPrompt(schoolContext);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10),
      { role: 'user', content: message }
    ];

    const completion = await zai.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 600,
    });

    const reply = completion.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that. Please try again.";

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      reply: "I'm having a momentary issue connecting. Please try again shortly!"
    }, { status: 500 });
  }
}
