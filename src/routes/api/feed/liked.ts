import { db } from '@/server/db';
import { twynts, likes, users } from '@/server/schema';
import { desc, and, eq, exists, or, isNull } from 'drizzle-orm';
import { twyntObj } from '../util';

export async function likedFeed(userId: string) {
	const feed = await db
		.select({
			...twyntObj(userId),
			likedAt: likes.liked_at
		})
		.from(likes)
		.innerJoin(twynts, eq(likes.twynt_id, twynts.id))
		.innerJoin(users, eq(twynts.user_id, users.id))
		.where(eq(likes.user_id, userId))
		.orderBy(desc(likes.liked_at))
		.limit(100);

	return feed;
}