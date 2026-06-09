import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const ADMIN_PIN = process.env.ADMIN_PIN || 'ceh2026';

function isAdmin(req: NextRequest): boolean {
  const pin = req.headers.get('x-admin-pin');
  return pin === ADMIN_PIN;
}

// GET all quiz sections with questions
export async function GET() {
  try {
    const sections = await db.quizSection.findMany({
      include: { questions: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(sections);
  } catch (error: any) {
    console.error('QuizSections GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch quiz sections' }, { status: 500 });
  }
}

// POST create a new quiz section
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { name, description, questions } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Section name is required' }, { status: 400 });
    }
    const section = await db.quizSection.create({
      data: {
        name,
        description: description || null,
        questions: questions && questions.length > 0 ? {
          create: questions.map((q: any, i: number) => ({
            question: q.question,
            options: q.options,
            correct: q.correct,
            points: q.points || 10,
          })),
        } : undefined,
      },
      include: { questions: true },
    });
    return NextResponse.json(section, { status: 201 });
  } catch (error: any) {
    console.error('QuizSections POST error:', error);
    return NextResponse.json({ error: 'Failed to create quiz section' }, { status: 500 });
  }
}

// PUT update a quiz section (including questions)
export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id, name, description, questions } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
    }
    // Delete existing questions and recreate
    await db.quizQuestion.deleteMany({ where: { sectionId: id } });
    const section = await db.quizSection.update({
      where: { id },
      data: {
        name,
        description: description || null,
        questions: {
          create: (questions || []).map((q: any, i: number) => ({
            question: q.question,
            options: q.options,
            correct: q.correct,
            points: q.points || 10,
          })),
        },
      },
      include: { questions: { orderBy: { createdAt: 'asc' } } },
    });
    return NextResponse.json(section);
  } catch (error: any) {
    console.error('QuizSections PUT error:', error);
    return NextResponse.json({ error: 'Failed to update quiz section' }, { status: 500 });
  }
}

// DELETE a quiz section (cascades to questions)
export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
    }
    await db.quizSection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('QuizSections DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete quiz section' }, { status: 500 });
  }
}
