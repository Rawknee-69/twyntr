import { json } from '@sveltejs/kit';
import { db } from '@/server/db';
import { twynts, likes, users, followers, history } from '@/server/schema';
import { sql, desc, and, eq, exists, or, isNull, not, inArray, asc } from 'drizzle-orm';
import { twyntObj } from '../util';

export async function mainFeed(userId: string, limit = 20, excludePosts: string[] = []) {
	const followedUsers = db
		.select({ followedId: followers.follower_id })
		.from(followers)
		.where(eq(followers.user_id, userId));

	const likeCounts = db
		.select({
			twyntId: likes.twynt_id,
			likeCount: sql<number>`count(*)`.as('like_count')
		})
		.from(likes)
		.groupBy(likes.twynt_id)
		.as('like_counts');

	let whereConditions = and(
		eq(users.banned, false),
		or(isNull(twynts.parent), eq(twynts.reposted, true)),
		sql`${twynts.created_at} > now() - interval '30 days'`
	);

	if (excludePosts.length > 0) {
		whereConditions = and(whereConditions, not(inArray(twynts.id, excludePosts)));
	}

	const feed = await db
		.select({
			...twyntObj(userId),
			isFollowed: inArray(twynts.user_id, followedUsers),
			likeCount: sql<number>`coalesce(${likeCounts.likeCount}, 0)`,
			isViewed: exists(
				db
					.select()
					.from(history)
					.where(and(eq(history.twynt_id, twynts.id), eq(history.user_id, userId)))
			),
			viewedAt: sql<Date>`(
                SELECT ${history.createdAt}
                FROM ${history}
                WHERE ${history.twynt_id} = ${twynts.id}
                AND ${history.user_id} = ${userId}
            )`
		})
		.from(twynts)
		.leftJoin(users, eq(twynts.user_id, users.id))
		.leftJoin(likeCounts, eq(twynts.id, likeCounts.twyntId))
		.leftJoin(history, and(eq(history.twynt_id, twynts.id), eq(history.user_id, userId)))
		.where(whereConditions)
		.orderBy(
			desc(sql`CASE WHEN ${history.id} IS NULL THEN 1 ELSE 0 END`),
			desc(twynts.created_at),
			desc(sql`CASE WHEN ${users.handle} = 'rem' THEN 1 ELSE 0 END`),
			desc(sql`CASE WHEN ${twynts.user_id} IN (${followedUsers}) THEN 1 ELSE 0 END`),
			desc(sql`COALESCE(${likeCounts.likeCount}, 0)`),
			desc(sql`CASE WHEN ${twynts.created_at} > now() - interval '24 hours' THEN 1 ELSE 0 END`)
		)
		.limit(limit);

	return feed;
}
