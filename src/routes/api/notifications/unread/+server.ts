import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { verifyAuthJWT } from '@/server/jwt';
import { db } from '@/server/db';
import { notifications, users, twynts } from '@/server/schema';
import { eq, desc, count, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ cookies }) => {
	const authCookie = cookies.get('_TOKEN__DO_NOT_SHARE');

	if (!authCookie) {
		return json({ error: 'Missing authentication' }, { status: 401 });
	}

	try {
		const jwtPayload = await verifyAuthJWT(authCookie);

		if (!jwtPayload.userId) {
			throw new Error('Invalid JWT token');
		}

		const userId = jwtPayload.userId;

		const unreadCountResult = await db
			.select({ count: count() })
			.from(notifications)
			.leftJoin(users, eq(notifications.sourceUserId, users.id))
			.leftJoin(twynts, eq(notifications.twyntId, twynts.id))
			.where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

		return json(unreadCountResult[0] || { count: 0 }, { status: 200 });
	} catch (error) {
		console.error('Error fetching notifications:', error);
		return json({ error: 'Failed to fetch notifications' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ cookies }) => {
	const authCookie = cookies.get('_TOKEN__DO_NOT_SHARE');

	if (!authCookie) {
		return json({ error: 'Missing authentication' }, { status: 401 });
	}

	try {
		const jwtPayload = await verifyAuthJWT(authCookie);

		if (!jwtPayload.userId) {
			throw new Error('Invalid JWT token');
		}

		const userId = jwtPayload.userId;

		await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));

		return json({ message: 'All notifications marked as read' }, { status: 200 });
	} catch (error) {
		console.error('Error updating notifications:', error);
		return json({ error: 'Failed to update notifications' }, { status: 500 });
	}
};
