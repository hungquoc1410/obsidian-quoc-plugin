import { GoodReadsBook, QuocPluginSettings } from './interfaces'

export const DEFAULT_BOOK: GoodReadsBook = {
	tags: '',
	author: '',
	date: '',
	rating: '',
	cover: '',
	page: '',
	title: '',
	desc: '',
}

export const DEFAULT_SETTINGS: QuocPluginSettings = {
	goodReadsBookTemplate:
		'---\ntags: {{Tag}}\nAuthor: {{Author}}\nDate: {{Date}}\nFinished:\nRating: {{Rating}}\nCover: {{Cover}}\nPage: {{Total Page}}\nCurrent:\n---\n# {{Title}}\n## Description\n{{Description}}\n## Notes\n',
	fileName: '{{Title}}',
	folder: '',
	templatePath: '',
}
