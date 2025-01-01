import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { verifyAuthJWT } from '@/server/jwt';
import { db } from '@/server/db';
import { twynts, likes, users, followers } from '@/server/schema';
import { sql, desc, and, eq, not, exists } from 'drizzle-orm';

import { twyntObj } from '../util';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const twyntId = url.searchParams.get('id');
	const authCookie = cookies.get('_TOKEN__DO_NOT_SHARE');

	if (!twyntId) {
		return json({ error: 'Missing twynt ID' }, { status: 400 });
	}

	if (!authCookie) {
		return json({ error: 'Missing authentication' }, { status: 401 });
	}

	try {
		const jwtPayload = await verifyAuthJWT(authCookie);

		if (!jwtPayload.userId) {
			throw new Error('Invalid JWT token');
		}

		const userId = jwtPayload.userId;

		// First, get the comments that the user has replied to
		const userReplies = await db
			.select(twyntObj(userId))
			.from(twynts)
			.leftJoin(likes, eq(likes.twynt_id, twynts.id))
			.leftJoin(users, eq(twynts.user_id, users.id))
			.where(
				and(
					eq(twynts.parent, twyntId),
					eq(twynts.reposted, false),
					exists(
						db
							.select()
							.from(twynts)
							.where(and(eq(twynts.parent, twynts.id), eq(twynts.user_id, userId)))
					)
				)
			)
			.groupBy(twynts.id, users.id)
			.orderBy(desc(twynts.created_at))
			.execute();

		// Then, get the most liked comments
		let mostLikedComments: {
			id: string;
			content: string;
			userId: string | null;
			createdAt: Date | null;
			views: number | null;
			reposted: boolean | null;
			parentId: string | null;
			likeCount: number;
			likedByFollowed: boolean;
			repostCount: number;
			commentCount: number;
			likedByUser: boolean;
			repostedByUser: boolean;
			handle: string | null;
			userCreatedAt: Date | null;
			username: string | null;
			iq: number | null;
			verified: boolean | null;
		}[] = [];
		if (userReplies.length < 50) {
			const notInClause =
				userReplies.length > 0
					? not(
							eq(
								twynts.id,
								sql`ANY(${sql`ARRAY[${sql.join(userReplies.map((reply) => reply.id))}]`})`
							)
						)
					: sql`TRUE`;

			mostLikedComments = await db
				.select(twyntObj(userId))
				.from(twynts)
				.leftJoin(likes, eq(likes.twynt_id, twynts.id))
				.leftJoin(users, eq(twynts.user_id, users.id))
				.where(and(eq(twynts.parent, twyntId), eq(twynts.reposted, false), notInClause))
				.groupBy(twynts.id, users.id)
				.orderBy(desc(sql`count(distinct ${likes.user_id})`), desc(twynts.created_at))
				// .limit(50 - userReplies.length)
				.execute();
		}
		const comments = [...userReplies, ...mostLikedComments];

		// Increment view counts in the background
		incrementViewCounts(comments.map((comment) => comment.id));

		return json(comments, { status: 200 });
	} catch (error) {
		console.error('Error fetching comments:', error);
		if (error instanceof Error) {
			console.error('Error message:', error.message);
			console.error('Error stack:', error.stack);
		}
		return json({ error: 'Failed to fetch comments' }, { status: 500 });
	}
};

async function incrementViewCounts(twyntIds: string[]) {
	try {
		await db.transaction(async (tx) => {
			await Promise.all(
				twyntIds.map((id) =>
					tx.execute(sql`UPDATE ${twynts} SET views = views + 1 WHERE id = ${id}`)
				)
			);
		});
	} catch (error) {
		console.error('Error incrementing view counts:', error);
	}
}
