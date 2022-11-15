import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian'
import { DEFAULT_SETTINGS } from 'src/constants'
import GoodReadsBookParser from 'src/goodReadsBookParser'
import { QuocPluginSettings } from 'src/interfaces'
import NoteCreator from 'src/noteCreator'

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

		const nc = new NoteCreator(this.app, this.settings.fileName)

		const new_note = await nc.createGoodReadsBookNote(
			bookNote,
			this.settings.folder
		)
		this.app.workspace.openLinkText(new_note, this.settings.folder)
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
				'New GoodReadsBook Notes will be saved here (default: Vault folder)'
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
				'Filename template when "New note" is selected. Available placeholders are {{Title}}, {{Timestamp}}, {{Date}}'
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
