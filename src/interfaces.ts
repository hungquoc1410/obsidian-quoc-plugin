export interface QuocPluginSettings {
	goodReadsBookTemplate: string
	fileName: string
	folder: string
	templatePath: string
}

export interface GoodReadsBookNote {
	title: string
	content: string
}

export interface GoodReadsBook {
	tags: string
	author: string
	date: string
	rating: string
	cover: string
	page: string
	title: string
	desc: string
}