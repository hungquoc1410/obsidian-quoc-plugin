import * as cheerio from 'cheerio'
import {
	moment,
	App,
	htmlToMarkdown,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	request,
	requestUrl,
	Setting,
} from 'obsidian'

interface QuocPluginSettings {
	goodReadsBookTemplate: string
	fileName: string
	folder: string
	templatePath: string
}

interface GoodReadsBookNote {
	title: string
	content: string
}

interface GoodReadsBook {
	tags: string
	author: string
	date: string
	rating: string
	cover: string
	page: string
	title: string
	desc: string
}

const DEFAULT_BOOK: GoodReadsBook = {
	tags: '',
	author: '',
	date: '',
	rating: '',
	cover: '',
	page: '',
	title: '',
	desc: '',
}

const DEFAULT_SETTINGS: QuocPluginSettings = {
	goodReadsBookTemplate:
		'---\ntags: {{Tag}}\nAuthor: {{Author}}\nDate: {{Date}}\nFinished:\nRating: {{Rating}}\nCover: {{Cover}}\nPage: {{Total Page}}\nCurrent:\n---\n# {{Title}}\n## Description\n{{Description}}\n## Notes\n',
	fileName: '{{Title}}',
	folder: '',
	templatePath: '',
}

class goodReadsBookNoteCreator {
	app: App
	filenameTemplate: string

	constructor(app: App, filenameTemplate: string) {
		this.app = app
		this.filenameTemplate = filenameTemplate
	}

	applyFileNameTemplate(book: GoodReadsBookNote) {
		return this.filenameTemplate
			.replace(/{{Title}}/g, book.title)
			.replace(/{{Date}}/g, moment().format('YYYY-MM-DD'))
			.replace(/[\\/:"*?<>|]*/g, '')
	}

	createGoodReadsBookNote(book: GoodReadsBookNote, folder: string) {
		const fileName = this.applyFileNameTemplate(book)
		try {
			this.app.vault.create(folder + '/' + fileName + '.md', book.content)
			return fileName
		} catch (error) {
			new Notice('Error creating GoodReads Book Note: ' + error)
			return undefined
		}
	}
}

class GoodReadsBookParser {
	template: string

	constructor(template: string) {
		this.template = template
	}

	async requestHTML(url: string) {
		try {
			const response = await request({ url: url, method: 'GET' })
			const parser = new DOMParser()
			return parser.parseFromString(response, 'text/html')
		} catch (reason) {
			new Notice('Error loading GoodReads link: ' + reason)
			return undefined
		}
	}

	sanitizeString(str: string) {
		return str.replace(/[-|{|}|:|,|[|\]|||>|<|#|"|']/g, ' ')
	}

	sanitizeBook(book: GoodReadsBook) {
		book.title = this.sanitizeString(book.title)
		return book
	}

	applyTemplate(book: GoodReadsBook): GoodReadsBookNote {
		book = this.sanitizeBook(book)
		const content = this.template
			.replace(/{{Title}}/g, book.title)
			.replace(/{{Description}}/g, book.desc)
			.replace(/{{Date}}/g, book.date)
			.replace(/{{Tag}}/g, book.tags)
			.replace(/{{Author}}/g, book.author)
			.replace(/{{Rating}}/g, book.rating)
			.replace(/{{Cover}}/g, book.cover)
			.replace(/{{Total Page}}/g, book.page)
		return { title: book.title, content: content }
	}

	reduceString = (text: string) => {
		return text.replace(/(\r\n|\n|\r)/gm, '').trim()
	}

	async loadBook(html: string | Buffer): Promise<GoodReadsBook> {
		const book = DEFAULT_BOOK

		const $ = cheerio.load(html)

		// Get Tags
		const tags: string[] = []
		$('div[class=left]').each((_idx, el) => {
			const tag = this.reduceString($(el).text())
			const length = tag.split('>').length
			tags.push(
				`book/${this.reduceString(
					tag.split('>')[length - 1]
				).toLowerCase()}`
			)
		})
		book.tags = tags.splice(0, 3).join(' ')

		// Get Author
		book.author = this.reduceString(
			$('div[id=bookAuthors] span[itemprop=author]').text()
		)

		// Get Date
		book.date = moment().format('YYYY-MM-DD')

		// Get Rating
		book.rating = this.reduceString(
			$('div[id=bookMeta] span[itemprop=ratingValue]').text()
		)

		// Get Cover
		book.cover =
			$('img[id=coverImage]').attr('src') || "Can't find information"

		// Get Total Page
		book.page = $(
			'div[id=details] div[class=row] span[itemprop=numberOfPages]'
		)
			.text()
			.replace(' pages', '')

		// Get Title
		book.title = this.reduceString($('h1[id=bookTitle]').text())

		// Get Description
		book.desc = htmlToMarkdown(
			$('div[id=descriptionContainer] div[id=description] span')
				.eq(1)
				.html() || "Can't find information"
		)
		return book
	}

	async getGoodReadsBookNote(url: string): Promise<GoodReadsBookNote> {
		const response = await requestUrl(url)
		const html = response.text

		if (html) {
			const book = await this.loadBook(html)
			const bookNote = this.applyTemplate(book)
			return bookNote
		} else {
			return { title: '', content: '' }
		}
	}
}

export default class QuocPlugin extends Plugin {
	settings: QuocPluginSettings

	async onload() {
		await this.loadSettings()

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-quoc-modal-plugin',
			name: 'Open Quoc Modal',
			callback: () => {
				new QuocPluginModal(this.app, this).open()
			},
		})

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new QuocSettingTab(this.app, this))
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		)
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	async getTemplate() {
		if (this.settings.templatePath != '') {
			let path = this.settings.templatePath
			if (!path.endsWith('.md')) {
				path += '.md'
			}
			const file = this.app.metadataCache.getFirstLinkpathDest(path, '')
			if (file) {
				return await this.app.vault.read(file)
			}
		}
		return this.settings.goodReadsBookTemplate
	}

	async newGoodReadsBookNote(url: string) {
		const template = await this.getTemplate()
		const parser = new GoodReadsBookParser(template)
		new Notice('Loading GoodReads Book Info')
		const bookNote = await parser.getGoodReadsBookNote(url)
		const nc = new goodReadsBookNoteCreator(
			this.app,
			this.settings.fileName
		)
		const newBookNote = nc.createGoodReadsBookNote(
			bookNote,
			this.settings.folder
		)
		if (newBookNote) {
			this.app.workspace.openLinkText(newBookNote, this.settings.folder)
		}
	}
}

class QuocPluginModal extends Modal {
	plugin: QuocPlugin

	constructor(app: App, plugin: QuocPlugin) {
		super(app)
		this.plugin = plugin
	}

	onOpen() {
		const { contentEl } = this
		contentEl.createEl('h3', { text: 'Enter GoodReads URL:' })
		const input = contentEl.createEl('input', { type: 'text' })
		contentEl.createEl('br')
		contentEl.createEl('br')
		const button = contentEl.createEl('button', {
			text: 'Add GoodReads Book Note',
		})

		button.addEventListener('click', () => {
			const url = input.value
			this.plugin.newGoodReadsBookNote(url)
			this.close()
		})
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}

class QuocSettingTab extends PluginSettingTab {
	plugin: QuocPlugin

	constructor(app: App, plugin: QuocPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()
		containerEl.createEl('h2', { text: 'Settings for GoodReads Book Note' })

		new Setting(containerEl)
			.setName('Template')
			.setDesc(
				'Define your own template. Available placeholders are: {{Title}}, {{ImageURL}}, {{Description}}, {{ShowNotes}}, {{EpisodeDate}}, {{PodcastURL}}, {{Date}}, {{Timestamp}}'
			)
			.addTextArea((textarea) => {
				textarea
					.setValue(this.plugin.settings.goodReadsBookTemplate)
					.onChange(async () => {
						this.plugin.settings.goodReadsBookTemplate =
							textarea.getValue()
						await this.plugin.saveSettings()
					})
				textarea.inputEl.rows = 10
				textarea.inputEl.cols = 35
			})

		new Setting(containerEl)
			.setName('Template File')
			.setDesc(
				'Define your own template in a .md file. Enter the path here (relative to vault)'
			)
			.addTextArea((textarea) =>
				textarea
					.setValue(this.plugin.settings.templatePath)
					.setPlaceholder('path/to/template')
					.onChange(async () => {
						this.plugin.settings.templatePath = textarea.getValue()
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName('Folder')
			.setDesc(
				'New Podcast Notes will be saved here (default: Vault folder)'
			)
			.addTextArea((textarea) =>
				textarea
					.setValue(this.plugin.settings.folder)
					.setPlaceholder('example: Podcasts')
					.onChange(async () => {
						this.plugin.settings.folder = textarea.getValue()
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName('Filename template')
			.setDesc(
				'Filename template when "New note" is selected. Available placeholders are {{Title}}, {{Date}}'
			)
			.addTextArea((textarea) =>
				textarea
					.setValue(this.plugin.settings.fileName)
					.onChange(async () => {
						this.plugin.settings.fileName = textarea.getValue()
						await this.plugin.saveSettings()
					})
			)
	}
}
