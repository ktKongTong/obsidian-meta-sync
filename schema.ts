import {integer, pgTable, timestamp, varchar} from "drizzle-orm/pg-core";

export const documents = pgTable('obsidiandocuments', {
	id: varchar('id').notNull(),
	title: varchar('title').notNull(),
	excerpt: varchar('excerpt'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	lastModifiedAt: timestamp('last_modified_at').notNull().defaultNow(),
	relativePath: varchar('path').notNull().default(''),
	parentId: varchar('parent_id'),
	tags: varchar('tags').array().notNull().default([]),
	type: varchar('type').notNull(),
	wordCount: integer('word_count').notNull().default(0)
})

export interface UpdateDocumentItem {
	id: string
	title: string
	parentId: string
	type: 'folder' | 'file'
}


export type DocumentSelect = typeof documents.$inferSelect
export type DocumentInsert = typeof documents.$inferInsert
