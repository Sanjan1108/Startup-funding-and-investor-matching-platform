import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ matchId: string }> }
) {
  const u = await currentUser();

  if (!u) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { matchId } = await context.params;
    const id = Number(matchId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: 'Invalid match ID.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const status = body.status;

    if (!['ACCEPTED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status.' },
        { status: 400 }
      );
    }

    // Update only matches belonging to the logged-in investor
    const [result]: any = await pool.execute(
      `
      UPDATE match_result m

      INNER JOIN investor i
        ON i.investor_id = m.investor_id

      SET m.status = ?

      WHERE m.match_id = ?
        AND i.user_id = ?
        AND m.status = 'PENDING'
      `,
      [status, id, u.user_id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          error: 'Match not found, already processed, or unauthorized.'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Match successfully ${status.toLowerCase()}.`,
      status
    });

  } catch (error) {
    console.error('Match status update error:', error);

    return NextResponse.json(
      { error: 'Unable to update match status.' },
      { status: 500 }
    );
  }
}