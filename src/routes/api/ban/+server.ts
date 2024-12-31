import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

import { verifyAuthJWT, deleteJWT, createAuthJWT } from '@/server/jwt';
import { db } from '@/server/db';
import { users, twynts } from '@/server/schema';
import { eq } from 'drizzle-orm';
import { deletetwynt } from '../util';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const admin = request.headers.get('Authorization');
	if (admin !== process.env.ADMIN_KEY) {
		return json({ status: 404 });
	}

	const body = await request.json();
	const { userId } = body;

	if (!userId) {
		return json({ error: 'userId is required' }, { status: 400 });
	}

	try {
		const [updatedUser] = await db
			.update(users)
			.set({ banned: true })
			.where(eq(users.id, userId))
			.returning();

		if (!updatedUser) {
			return json({ error: 'User not found' }, { status: 404 });
		}

        setTimeout(async () => {
            try {
                const usertwynts = await db
                    .select({ id: twynts.id })
                    .from(twynts)
                    .where(eq(twynts.user_id, userId));

                for (const twynt of usertwynts) {
                    await deletetwynt(twynt.id);
                }
			} catch (error) {
                console.error('Error deleting twynts:', error);
            }
        }, 0);

		const token = cookies.get('authToken');
		if (token) {
			await deleteJWT(token);
		}

		return json(
			{
				message: 'User banned successfully and token revoked'
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error('Error updating user:', error);
		return json({ error: 'Failed to update user' }, { status: 500 });
	}
};
