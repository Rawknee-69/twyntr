import { json } from '@sveltejs/kit';
import { db } from '@/server/db';
import { twynts, likes, users, followers, history } from '@/server/schema';
import { sql, desc, and, eq, not, exists, or, isNull } from 'drizzle-orm';
import { twyntObj } from '../util';

export async function followingFeed(userId: string) {
	const feed = await db
		.select(twyntObj(userId))
		.from(twynts)
		.leftJoin(likes, eq(likes.twynt_id, twynts.id))
		.leftJoin(users, eq(twynts.user_id, users.id))
		.where(
			and(
				or(isNull(twynts.parent), eq(twynts.reposted, true)),
				exists(
					db
						.select()
						.from(followers)
						.where(and(eq(followers.user_id, twynts.user_id), eq(followers.follower_id, userId)))
				)
			)
		)
		.groupBy(twynts.id, users.id)
		.orderBy(desc(twynts.created_at))
		.limit(100);

	return feed;
}
