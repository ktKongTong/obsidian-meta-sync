import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {DocumentInsert, documents, DocumentSelect} from './schema'
import {inArray, sql} from "drizzle-orm";
import {PgTable, PgUpdateSetSource} from "drizzle-orm/pg-core";

export type LocalFolderData = {
	id: string,
	title: string,
	parentId: string | null,
	path: string,
	type: 'folder'
	tags?: [],
	excerpt?: ""
	// wordcount?: 0,
	date?: Date,
}

export type LocalMDData = {
	id: string,
	title: string,
	parentId?: string,
	path: string,
	type: 'file',
	tags: string[],
	excerpt: string,
	// wordcount: number,
	date: Date,
}

export type LocalData = LocalMDData | LocalFolderData
export function conflictUpdateSet<TTable extends PgTable>(
	table: TTable,
	columns: (keyof TTable["_"]["columns"] & keyof TTable)[],
): PgUpdateSetSource<TTable> {
	return Object.assign(
		{},
		...columns.map((k) => ({ [k]: sql.raw(`excluded.${(table[k] as any).name}`) })),
	) as PgUpdateSetSource<TTable>;
}
export const db = (connectionString: string) => {
	const client = postgres(connectionString)
	const db = drizzle(client);
	const equal = (local:LocalData, doc: DocumentSelect) => {
		if(local.type != doc.type) {
			return false
		}
		if(local.parentId != doc.parentId) {
			return false
		}
		if(local.path != doc.relativePath) {
			return false
		}
		if(local.title != doc.title) {
			return false
		}
		if(local.type == 'folder' && local.id == doc.id) {
			return true
		}
		if(local.excerpt != doc.excerpt) {
			return false
		}
		if(local.tags?.toString() != doc.tags.toString()) {
			return false
		}
		return local.id == doc.id;

	}
	const diff = (local:LocalData[],docs:DocumentSelect[]):{
		needUpdate: DocumentInsert[],
		needCreate: DocumentInsert[],
		needDelete: DocumentSelect[],
	} => {
		const localNeedCreate = local.filter(item=>!docs.map(it=>it.id).includes(item.id))
		const needCreate = localNeedCreate.map((it:LocalData) => ({
			id: it.id,
			title: it.title,
			excerpt: (it as any).excerpt ?? "",
			createdAt: (it as any).date ?? undefined,
			parentId: it.parentId,
			relativePath: it.path,
			// wordcount: it.wordcount,
			tags: (it as any).tags ?? [],
			type: it.type,
		}))

		const needUpdate = local.filter(item=>{
			const remote = docs.find(it=>it.id == item.id)
			return remote && !equal(item,remote)
		})
			.map((it:LocalData) => ({
				id: it.id,
				title: it.title,
				excerpt: (it as any).excerpt ?? "",
				createdAt: (it as any).date ?? undefined,
				parentId: it.parentId,
				relativePath: it.path,
				tags: (it as any).tags ?? [],
				type: it.type,
			}))
		const needDelete = docs.filter(item=>!local.map(it=>it.id).includes(item.id))
		return {
			needUpdate,
			needDelete,
			needCreate
		}

	}
	return {
		async getDocuments():Promise<DocumentSelect[]> {
			const allDocuments = await db.select().from(documents);
			return allDocuments;
		},
		async syncDocs(data: LocalData[]) {

			const allDocuments = await db.select().from(documents);
			const {needUpdate, needDelete, needCreate} = diff(data, allDocuments);
			await db.insert(documents).values(needUpdate.concat(needCreate))
				.onConflictDoUpdate({target: documents.id, set:  conflictUpdateSet(documents, [
						"title",
						"relativePath",
						"parentId",
						"tags",
						"type",
						"title",
						"excerpt",
					])})
			await db.delete(documents).where(inArray(documents.id, needDelete.map(it=>it.id)))
		}
	}



}
