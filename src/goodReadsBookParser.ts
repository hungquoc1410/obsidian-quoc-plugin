import * as cheerio from 'cheerio'
import { moment, htmlToMarkdown, Notice, request, requestUrl } from 'obsidian'
import { DEFAULT_BOOK } from './constants'
import { GoodReadsBook, GoodReadsBookNote } from './interfaces'

export default class GoodReadsBookParser {
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

	sanitizePodcast(book: GoodReadsBook) {
		book.title = this.sanitizeString(book.title)
		return book
	}

	applyTemplate(book: GoodReadsBook): GoodReadsBookNote {
		book = this.sanitizePodcast(book)
		const content = this.template
			.replace(/{{Title}}/g, book.title)
			.replace(/{{Description}}/g, book.desc)
			.replace(/{{Date}}/g, book.date)
			.replace(/{{Tag}}/g, book.tags)
			.replace(/{{Author}}/g, book.author)
			.replace(/{{Rating}}/g, book.rating)
			.replace(/{{Cover}}/g, book.cover)
			.replace(/{{Total Page}}/g, book.page)
			.replace(/{{Timestamp}}/g, Date.now().toString())
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
