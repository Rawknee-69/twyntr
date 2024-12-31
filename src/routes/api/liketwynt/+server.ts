import { json } from '@sveltejs/kit';
import type { Cookies, RequestHandler } from '@sveltejs/kit';
import { verifyAuthJWT } from '@/server/jwt';
import { db } from '@/server/db';
import { twynts, likes } from '@/server/schema';
import { eq, and } from 'drizzle-orm';
import { createNotification } from '@/server/notifications';
import { normalRatelimit } from '@/server/ratelimit';

// POST endpoint to like a twynt
export const POST: RequestHandler = async ({
	request,
	cookies
}: {
	request: Request;
	cookies: Cookies;
}) => {
	const authCookie = cookies.get('_TOKEN__DO_NOT_SHARE');

	if (!authCookie) {
		return json({ error: 'Missing authentication' }, { status: 401 });
	}

	let userId: string;

	try {
		const jwtPayload = await verifyAuthJWT(authCookie);

		userId = jwtPayload.userId;

		if (!userId) {
			throw new Error('Invalid JWT token');
		}
	} catch (error) {
		console.error('Authentication error:', error);
		return json({ error: 'Authentication failed' }, { status: 401 });
	}

	const body = await request.json();
	const { twyntId } = body;

	if (!twyntId || typeof twyntId !== 'string') {
		return json({ error: 'Invalid twynt ID' }, { status: 400 });
	}

	const { success } = await normalRatelimit.limit(userId);
	if (!success) {
		return json({ error: 'You are being ratelimited.' }, { status: 429 });
	}

	try {
		const [twynt] = await db.select().from(twynts).where(eq(twynts.id, twyntId)).limit(1);

		if (!twynt) {
			return json({ error: 'twynt not found' }, { status: 404 });
		}

		const [existingLike] = await db
			.select()
			.from(likes)
			.where(and(eq(likes.twynt_id, twyntId), eq(likes.user_id, userId)))
			.limit(1);

		if (existingLike) {
			await db.delete(likes).where(and(eq(likes.twynt_id, twyntId), eq(likes.user_id, userId)));
			return json({ message: 'twynt unliked successfully' });
		} else {
			await db.insert(likes).values({
				twynt_id: twyntId,
				user_id: userId
			});

			if (userId !== twynt.user_id && twynt.user_id) {
				await createNotification(twynt.user_id, 'like', userId, twyntId);
			}

			return json({ message: 'twynt liked successfully' });
		}
	} catch (error) {
		console.error('Error liking/unliking twynt:', error);
		return json({ error: 'Failed to like/unlike twynt' }, { status: 500 });
	}
};
