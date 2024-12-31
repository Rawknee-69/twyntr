import { json } from '@sveltejs/kit';
import type { Cookies, RequestHandler } from '@sveltejs/kit';
import { verifyAuthJWT } from '@/server/jwt';
import { db } from '@/server/db';
import { twynts, likes, notifications, history, users } from '@/server/schema';
import { eq, sql, and, or, inArray } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';
import { Snowflake } from 'nodejs-snowflake';
import sharp from 'sharp';
import { minioClient } from '@/server/minio';
import { deletetwynt, twyntObj,fetchReferencedtwynts } from '../util';
import { sendMessage } from '@/sse';
// import { isImageNsfw, NSFW_ERROR } from '@/moderation';
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

	const formData = await request.formData();

	let content = formData.get('content') as string;
	const imageFile = formData.get('image') as File | null;
	const reposted = formData.get('reposted') as string;

	if (!content) content = '';

	if (content.length > 300) {
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

		if (reposted) {
			const [existingtwynt] = await db
				.select({ id: twynts.id })
				.from(twynts)
				.where(eq(twynts.id, reposted))
				.limit(1);

			if (existingtwynt) {
				twyntValues.reposted = true;
				twyntValues.parent = reposted;
			} else {
				return json({ error: 'Invalid reposted twynt ID' }, { status: 400 });
			}
		}

		if (imageFile) {
			const buffer = await imageFile.arrayBuffer();
			const inputBuffer = Buffer.from(buffer);

			// if (await isImageNsfw(inputBuffer)) {
			// 	return NSFW_ERROR;
			// }

			const resizedBuffer = await sharp(inputBuffer, {
				animated: true
			})
				.rotate()
				.webp({ quality: 70 })
				.withMetadata()
				.toBuffer();

			const fileName = `${uniquetwyntId}.webp`;

			await minioClient.putObject(
				process.env.S3_BUCKET_NAME!,
				fileName,
				resizedBuffer,
				resizedBuffer.length,
				{
					'Content-Type': 'image/webp'
				}
			);

			twyntValues.has_image = true;
		}

		const [newtwynt] = await db.insert(twynts).values(twyntValues).returning();
		// await moderate(content, newtwynt.id, userId);

		sendMessage(uniquetwyntId);

		return json(newtwynt, { status: 201 });
	} catch (error) {
		console.error('Error creating twynt:', error);
		return json({ error: 'Failed to create twynt' }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({
	url,
	request,
	cookies
}: {
	url: URL;
	request: Request;
	cookies: Cookies;
}) => {
	let userId: string | null;

	const authCookie = cookies.get('_TOKEN__DO_NOT_SHARE');
	const admin = request.headers.get('Authorization');

	if (!authCookie) {
		return json({ error: 'Missing authentication' }, { status: 401 });
	}

	if (admin === process.env.ADMIN_KEY && process.env.SUDO_USER_ID) {
		userId = process.env.SUDO_USER_ID;
	} else {
		try {
			const jwtPayload = await verifyAuthJWT(authCookie);

			userId = jwtPayload.userId;

			if (!userId) {
				throw new Error('Invalid JWT token');
			}
		} catch (error) {
			userId = null
		}
	}
	const twyntId = url.searchParams.get('id');

	if (!twyntId) {
		return json({ error: 'Missing twynt ID' }, { status: 400 });
	}

	try {
		if (!userId) {
			return json({ error: 'Authentication failed' }, { status: 401 });
		}
		const twyntobj = twyntObj(userId);

		const [twynt] = await db
			.select({ ...twyntobj, parent: twynts.parent })
			.from(twynts)
			.leftJoin(users, eq(twynts.user_id, users.id))
			.where(eq(twynts.id, twyntId))
			.limit(1);

		if (!twynt) {
			return json({ error: 'twynt not found' }, { status: 404 });
		}

		await db.execute(sql`UPDATE ${twynts} SET views = views + 1 WHERE id = ${twyntId}`);

		const referencedtwynts = await fetchReferencedtwynts(userId, twynt.parent);

		return json({ ...twynt, referencedtwynts });
	} catch (error) {
		console.error('Error fetching twynt:', error);
		return json({ error: 'Failed to fetch twynt' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({
	request,
	url,
	cookies
}: {
	request: Request;
	url: URL;
	cookies: Cookies;
}) => {
	const admin = request.headers.get('Authorization');
	const twyntId = url.searchParams.get('id');

	if (!twyntId) {
		return json({ error: 'Missing twynt ID' }, { status: 400 });
	}

	if (admin === process.env.ADMIN_KEY) {
		await deletetwynt(twyntId);
		return json({ message: 'Done' }, { status: 200 });
	}

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

	try {
		// Check if the twynt exists and belongs to the authenticated user
		const [twynt] = await db
			.select({ id: twynts.id, user_id: twynts.user_id })
			.from(twynts)
			.where(eq(twynts.id, twyntId))
			.limit(1);

		if (!twynt) {
			return json({ error: 'twynt not found' }, { status: 404 });
		}

		if (twynt.user_id !== userId) {
			return json({ error: 'Unauthorized to delete this twynt' }, { status: 403 });
		}

		await deletetwynt(twyntId);

		return json({ message: 'twynt and related data deleted successfully' }, { status: 200 });
	} catch (error) {
		console.error('Error deleting twynt:', error);
		return json({ error: 'Failed to delete twynt' }, { status: 500 });
	}
};
