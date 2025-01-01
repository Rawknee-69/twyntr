import { db } from '@/server/db';
import { twynts, likes, followers, users, notifications, history } from '@/server/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import sharp from 'sharp';

export async function fetchReferencedtwynts(
	userId: string | null,
	parentId: string | null
): Promise<any[]> {
	const referencedLynts: any[] = [];

	async function fetchParent(currentParentId: string) {
		const obj = twyntObj(userId ?? '');

		const [parent] = await db
			.select(obj)
			.from(twynts)
			.leftJoin(users, eq(twynts.user_id, users.id))
			.where(and(eq(twynts.id, currentParentId), eq(twynts.reposted, false)))
			.limit(1);

		if (parent) {
			referencedLynts.unshift(parent); // Add to the beginning of the array
			if (parent.parentId) {
				await fetchParent(parent.parentId);
			}
		}
	}

	if (parentId) {
		await fetchParent(parentId);
	}

	return referencedLynts;
}

export const twyntObj = (userId: string) => {
	return {
		id: twynts.id,
		content: twynts.content,
		userId: twynts.user_id,
		createdAt: twynts.created_at,
		views: sql<number>`(
            SELECT COUNT(*) 
            FROM ${history} 
            WHERE ${history.twynt_id} = ${twynts.id}
        )`.as('views'),
		reposted: twynts.reposted,
		parentId: twynts.parent,
		has_image: twynts.has_image,
		likeCount:
			sql<number>`(SELECT COUNT(*) FROM ${likes} WHERE ${likes.twynt_id} = ${twynts.id})`.as(
				'likeCount'
			),
		likedByFollowed: sql<boolean>`exists(
        select 1 from ${followers}
        where ${followers.user_id} = ${userId}
        and ${followers.follower_id} = ${twynts.user_id}
    )`.as('liked_by_followed'),
		repostCount: sql<number>`(
        select count(*) from ${twynts} as reposts
        where reposts.parent = ${twynts.id} and reposts.reposted = true
    )`.as('repost_count'),
		commentCount: sql<number>`(
        select count(*) from ${twynts} as comments
        where comments.parent = ${twynts.id} and comments.reposted = false
    )`.as('comment_count'),
		likedByUser: sql<boolean>`exists(
        select 1 from ${likes}
        where ${likes.twynt_id} = ${twynts.id}
        and ${likes.user_id} = ${userId}
    )`.as('liked_by_user'),
		repostedByUser: sql<boolean>`exists(
        select 1 from ${twynts} as reposts
        where reposts.parent = ${twynts.id}
        and reposts.reposted = true
        and reposts.user_id = ${userId}
    )`.as('reposted_by_user'),
		handle: users.handle,
		bio: users.bio,
		userCreatedAt: users.created_at,
		username: users.username,
		iq: users.iq,
		verified: users.verified,
		parentContent: sql<string>`(
            select content from ${twynts} as parent
            where parent.id = ${twynts.parent}
        )`.as('parent_content'),
		parentHasImage: sql<string>`(
            select has_image from ${twynts} as parent
            where parent.id = ${twynts.parent}
        )`.as('has_image'),
		parentUserHandle: sql<string>`(
        select handle from ${users} as parent_user
        where parent_user.id = (
            select user_id from ${twynts} as parent
            where parent.id = ${twynts.parent}
        )
    )`.as('parent_user_handle'),
		parentUserCreatedAt: sql<string>`(
        select created_at from ${users} as parent_user
        where parent_user.id = (
            select user_id from ${twynts} as parent
            where parent.id = ${twynts.parent}
        )
    )`.as('parent_user_created_at'),
		parentUserBio: sql<string>`(
        select bio from ${users} as parent_user
        where parent_user.id = (
            select user_id from ${twynts} as parent
            where parent.id = ${twynts.parent}
        )
    )`.as('bio'),
		parentUserUsername: sql<string>`(
        select username from ${users} as parent_user
        where parent_user.id = (
            select user_id from ${twynts} as parent
            where parent.id = ${twynts.parent}
        )
    )`.as('parent_user_username'),
		parentUserVerified: sql<boolean>`(
        select verified from ${users} as parent_user
        where parent_user.id = (
            select user_id from ${twynts} as parent
            where parent.id = ${twynts.parent}
        )
    )`.as('parent_user_verified'),
		parentUserIq: sql<number>`(
        select iq from ${users} as parent_user
        where parent_user.id = (
            select user_id from ${twynts} as parent
            where parent.id = ${twynts.parent}
        )
    )`.as('parent_user_iq'),
		parentUserId: sql<number>`(
        select id from ${users} as parent_user
        where parent_user.id = (
            select user_id from ${twynts} as parent
            where parent.id = ${twynts.parent}
        )
    )`.as('parent_user_id'),
		parentCreatedAt: sql<string>`(
        select created_at from ${twynts} as parent
        where parent.id = ${twynts.parent}
    )`.as('parent_created_at')
	};
};

export async function uploadAvatar(inputBuffer: Buffer, fileName: string, minioClient: any) {
	const buffer_small = await sharp(inputBuffer).resize(40, 40).webp().toBuffer();

	const buffer_medium = await sharp(inputBuffer).resize(50, 50).webp().toBuffer();

	const buffer_big = await sharp(inputBuffer).resize(160, 160).webp().toBuffer();

	const shits = [
		{ filename: fileName + '_small.webp', buffer: buffer_small },
		{ filename: fileName + '_medium.webp', buffer: buffer_medium },
		{ filename: fileName + '_big.webp', buffer: buffer_big }
	];

	for (const shit of shits) {
		await minioClient.removeObject(process.env.S3_BUCKET_NAME!, shit.filename);
		await minioClient.putObject(
			process.env.S3_BUCKET_NAME!,
			shit.filename,
			shit.buffer,
			shit.buffer.length,
			{
				'Content-Type': 'image/webp'
			}
		);
	}
}

export async function deletetwynt(twyntId: string) {
	await db.transaction(async (trx) => {
		// Get all comments under this twynt
		const comments = await trx
			.select({ id: twynts.id })
			.from(twynts)
			.where(eq(twynts.parent, twyntId));

		const commentIds = comments.map((comment) => comment.id);
		const allIds = [twyntId, ...commentIds];

		// Delete likes associated with the comments and the original twynt
		await trx.delete(likes).where(inArray(likes.twynt_id, allIds));

		// Delete notifications associated with the comments and the original twynt
		await trx.delete(notifications).where(inArray(notifications.twyntId, allIds));

		// Delete history entries associated with the comments and the original twynt
		await trx.delete(history).where(inArray(history.twynt_id, allIds));

		// Delete all comments under this twynt
		await trx.delete(twynts).where(and(eq(twynts.parent, twyntId), eq(twynts.reposted, false)));

		// Update reposts of this twynt
		await trx
			.update(twynts)
			.set({
				content: sql`${twynts.content} || '\nThe twynt this user is reposting has been since deleted.'`,
				parent: null
			})
			.where(and(eq(twynts.parent, twyntId), eq(twynts.reposted, true)));

		// Delete the original twynt
		await trx.delete(twynts).where(eq(twynts.id, twyntId));
	});
}
