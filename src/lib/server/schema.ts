import {
	boolean,
	date,
	pgTable,
	serial,
	timestamp,
	varchar,
	integer,
	type AnyPgColumn,
	primaryKey,
	text,
	uuid,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';

export const users = pgTable('users', {
	id: text('id').primaryKey(),
	username: varchar('username', { length: 60 }).notNull(),
	handle: varchar('handle', { length: 32 }).notNull().unique(),
	bio: varchar('bio', { length: 256 }).default('Nothing here yet...'),
	created_at: timestamp('created_at').defaultNow(),
	banned: boolean('banned').default(false),
	iq: integer('iq').notNull(),
	token: text('token').default('a'),
	email: text('email').notNull(),
	verified: boolean('verified').default(false)
});

export const twynts = pgTable('twynts', {
	id: text('id').primaryKey(),
	user_id: text('user_id').references(() => users.id),
	content: text('content').notNull(),
	views: integer('views').default(0),
	shares: integer('shares').default(0),
	has_link: boolean('has_link').default(false),
	has_image: boolean('has_image').default(false),
	created_at: timestamp('created_at').defaultNow(),
	reposted: boolean('reposted').default(false),
	parent: text('parent').references((): AnyPgColumn => twynts.id)
});

export const followers = pgTable(
	'followers',
	{
		user_id: text('user_id')
			.references(() => users.id)
			.notNull(),
		follower_id: text('follower_id')
			.references(() => users.id)
			.notNull()
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.user_id, table.follower_id], name: 'followers_pkey' }) // Replace 'followers_pkey' with the actual constraint name from your database
		};
	}
);

export const likes = pgTable(
	'likes',
	{
		twynt_id: text('twynt_id')
			.references(() => twynts.id)
			.notNull(),
		user_id: text('user_id')
			.references(() => users.id)
			.notNull(),
		liked_at: timestamp('liked_at').defaultNow()
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.twynt_id, table.user_id], name: 'likes_pkey' }) // Replace 'likes_pkey' with the actual constraint name from your database
		};
	}
);

export const notifications = pgTable('notifications', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	type: text('type').notNull(), // e.g., 'like', 'comment', 'follow'
	sourceUserId: text('source_user_id').references(() => users.id),
	twyntId: text('twynt_id').references(() => twynts.id),
	read: boolean('read').default(false),
	createdAt: timestamp('created_at').defaultNow()
});

export const history = pgTable(
	'history',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		user_id: text('user_id').references(() => users.id),
		twynt_id: text('twynt_id').references(() => twynts.id),
		createdAt: timestamp('created_at').defaultNow()
	},
	(table) => {
		return {
			uniqueUsertwynt: uniqueIndex('unique_user_twynt').on(table.user_id, table.twynt_id)
		};
	}
);
