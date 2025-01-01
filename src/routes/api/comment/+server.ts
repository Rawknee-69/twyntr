import { json } from '@sveltejs/kit';
import type { Cookies, RequestHandler } from '@sveltejs/kit';
import { verifyAuthJWT } from '@/server/jwt';
import { db } from '@/server/db';
import { twynts, likes, users } from '@/server/schema';
import { eq, sql, isNull, not, and } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';
import { Snowflake } from 'nodejs-snowflake';
import { createNotification } from '@/server/notifications';
import { twyntObj } from '../util';
import { sensitiveRatelimit } from '@/server/ratelimit';

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
	const { success } = await sensitiveRatelimit.limit(userId);
	if (!success) {
		return json({ error: 'You are being ratelimited.' }, { status: 429 });
	}

	const body = await request.json();
	const { content, id } = body;

	if (!content || typeof content !== 'string' || content.length > 300) {
		return json({ error: 'Invalid content' }, { status: 400 });
	}

	try {
		const twyntId = new Snowflake({
			custom_epoch: new Date('2024-07-13T11:29:44.526Z').getTime()
		});

		const uniquetwyntId = String(twyntId.getUniqueID());

		let twyntValues: any = {
			id: uniquetwyntId,
			user_id: userId,
			content: content,
			has_link: content.includes('http')
		};

		const [existingtwynt] = await db
			.select({ id: twynts.id, userId: twynts.user_id })
			.from(twynts)
			.where(eq(twynts.id, id))
			.limit(1);

		if (existingtwynt) {
			twyntValues.parent = id;
		} else {
			return json({ error: 'Invalid reposted twynt ID' }, { status: 400 });
		}

		let newId = (await db.insert(twynts).values(twyntValues).returning())[0].id || null;
		let [newtwynt] = await db
			.select(twyntObj(userId))
			.from(twynts)
			.leftJoin(likes, eq(likes.twynt_id, twynts.id))
			.leftJoin(users, eq(twynts.user_id, users.id))
			.where(eq(twynts.id, newId!))
			.limit(1);

		if (existingtwynt.userId && existingtwynt.userId !== userId) {
			await createNotification(existingtwynt.userId, 'comment', userId, newtwynt.id);
		}

		return json(newtwynt, { status: 201 });
	} catch (error) {
		console.error('Error creating twynt:', error);
		return json({ error: 'Failed to create twynt' }, { status: 500 });
	}
};
