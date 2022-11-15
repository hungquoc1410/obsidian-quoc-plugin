import { App, moment } from 'obsidian'
import { GoodReadsBookNote } from './interfaces'

export default class NoteCreator {
	app: App
	filenameTemplate: string

	constructor(app: App, filenameTemplate: string) {
		this.app = app
		this.filenameTemplate = filenameTemplate
	}

	applyFileNameTemplate(book: GoodReadsBookNote) {
		return this.filenameTemplate
			.replace(/{{Title}}/g, book.title)
			.replace(/{{Timestamp}}/g, Date.now().toString())
			.replace(/{{Date}}/g, moment().format('YYYY-MM-DD'))
			.replace(/[\\/:"*?<>|]*/g, '')
	}

	async createGoodReadsBookNote(book: GoodReadsBookNote, folder: string) {
		const fileName = this.applyFileNameTemplate(book)
		await this.app.vault.create(
			folder + '/' + fileName + '.md',
			book.content
		)
		return fileName
	}
}
