// handle.ts
import { json } from '@sveltejs/kit';
import { db } from '@/server/db';
import { twynts, likes, users } from '@/server/schema';
import { sql, desc, and, eq, or, isNull } from 'drizzle-orm';
import { twyntObj } from '../util';

export async function handleFeed(handleUserId: string, userId: string) {
	const totaltwyntsResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(twynts)
		.where(eq(twynts.user_id, handleUserId));

	const feed = await db
		.select(twyntObj(userId))
		.from(twynts)
		.leftJoin(likes, eq(likes.twynt_id, twynts.id))
		.leftJoin(users, eq(twynts.user_id, users.id))
		.where(
			and(
				eq(twynts.user_id, handleUserId),
				or(and(eq(twynts.reposted, false), isNull(twynts.parent)), eq(twynts.reposted, true))
			)
		)
		.groupBy(twynts.id, users.id)
		.orderBy(desc(twynts.created_at))
		.limit(50);

	return feed;
}
