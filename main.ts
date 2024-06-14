import {App,Notice, Plugin, PluginSettingTab, Setting, TFile,} from 'obsidian';
import { nanoid } from 'nanoid'
import {db, LocalData, LocalMDData} from './db';

interface DocMetaDBSyncerPluginSettings {
	connectionString: string;
	includePattern: string;
}

const DEFAULT_SETTINGS: DocMetaDBSyncerPluginSettings = {
	connectionString: 'connectionString',
	includePattern: '*',
}


export default class DocMetaDBSyncerPlugin extends Plugin {
	settings: DocMetaDBSyncerPluginSettings;
	db: ReturnType<typeof db>
	async onload() {
		await this.loadSettings();
		if(this.settings.connectionString !== DEFAULT_SETTINGS.connectionString) {
			this.db = db(this.settings.connectionString)
			new Notice("success init db")
		}
		this.registerEvent(this.app.vault.on('create', (file) => this.addNanoIdToFile(file as never)))
		const ribbonIconEl = this.addRibbonIcon('dice', 'addNanoIdToExistingFiles', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('addNanoIdToExistingFiles!');
			this.addNanoIdToExistingFiles().then(()=>new Notice('addNanoIdSuccess!'))
		});

		const syncRibbonIconEl = this.addRibbonIcon('dice', 'sync', async (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('sync to db!');
			await this.syncToDB()
				.then(()=>new Notice('sync success!'))
		});
		syncRibbonIconEl.addClass('my-plugin-ribbon-class');
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');
		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();

		statusBarItemEl.setText('Status Bar Text');

		this.addCommand({
			id: 'add-nano-to-existing-files',
			name: 'Add UUID to Existing Files',
			callback: () => this.addNanoIdToExistingFiles()
		});
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));


		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}
	async syncToDB() {
		if(this.db) {
			const data = await this.getDataNeedSync()
			await this.db.syncDocs(data)
		}
	}
	async getDataNeedSync():Promise<LocalData[]> {
		const mds = this.app.vault.getMarkdownFiles()
		const metas:(LocalMDData & {file:TFile})[] = (await Promise.all(mds.map(md => this.extractMDData(md))))
			.filter(it=> it != null) as never as (LocalMDData & {file:TFile})[]

		const folders = new Map<string, LocalData>();
		// add root to folders
		metas.forEach(it=> {
			if(!it) return
			let parent = it.file.parent
			while(parent) {
				const id = parent.path
				const p = parent.parent
				folders.set(id,  {
					id: id,
					path: parent.path,
					title: parent.name,
					parentId: parent.isRoot() ? null: p?.path ?? null,
					type:'folder'
				});
				parent = parent.isRoot() ? null : p;
			}
		})
		const folderArr:LocalData[] = []
		for (const [, folder] of folders) {
			folderArr.push(folder)
		}
		const toBeSynced:LocalData[] = metas.map((it)=> ({
			id: it.id,
			date: it.date,
			title: it.title,
			parentId: it.file.parent?.path,
			path: it.path,
			type: 'file',
			// wordcount: it.wordcount,
			tags: it.tags,
			excerpt: it.excerpt,
		}))
		return toBeSynced.concat(folderArr);
	}
	async extractMDData(file:TFile):Promise<(LocalMDData & {file:TFile}) | null> {
		if (file.extension !== 'md') return null;
		const metadata = this.app.metadataCache.getFileCache(file);
		const frontMatter = metadata?.frontmatter;
		if (!frontMatter) {
			throw new Error('some md does container metadata');
		}
		// read file
		// const content = await file.vault.read(file)
		return {
			title: (frontMatter.title || file.basename) as string,
			id: frontMatter.id as string,
			path: file.path,
			date: frontMatter?.date ? new Date(frontMatter.date)  : new Date(file.stat.ctime),
			excerpt: (frontMatter?.excerpt || '') as string,
			tags: (frontMatter?.tags || []) as string[],
			type: 'file',
			// wordcount: getWordCount(content),
			file: file
		};
	}

	async addNanoIdToFile(file: TFile) {
		if (file.extension === 'md') {
			const content = await this.app.vault.read(file);
			if (!content.startsWith('---')) {
				const newContent = `---
id: ${nanoid()}
---
${content}`;
				await this.app.vault.modify(file, newContent);
			} else {
				const lines = content.split('\n');
				const idx = lines.findIndex(line => line === '---');
				lines.splice(idx + 1, 0, `id: ${nanoid()}`);
				const newContent = lines.join('\n');
				await this.app.vault.modify(file, newContent);
			}
		}
	}
	async addNanoIdToExistingFiles() {
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			await this.addNanoIdToFile(file)
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: DocMetaDBSyncerPlugin;

	constructor(app: App, plugin: DocMetaDBSyncerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('connectionString')
			.setDesc('DBConnectionString')
			.addText(text => text
				.setPlaceholder('Enter your db ConnectionString')
				.setValue(this.plugin.settings.connectionString)
				.onChange(async (value) => {
					this.plugin.settings.connectionString = value;
					await this.plugin.saveSettings();
				}));
	}
}

