import { App, Vault, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl } from 'obsidian';
import TurndownService from 'turndown';
import url from 'url';
import { extractReadable } from './code';
import { dirname } from 'path';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function createFolderGracefully(vault: Vault, path: string) {
	const list: string[] = [];

	let current = path;
	while (vault.getFolderByPath(current) === null) {
		list.unshift(current);
		current = dirname(current);
		if (current === '.') {
			break;
		}
	}

	for (const p of list) {
		await vault.createFolder(p);
	}
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Get Content from Clipboard Link', async (evt: MouseEvent) => {
			const readingDir = '0 Reading';

			// Clipboard text
			const copied = await navigator.clipboard.readText();

			// Download & parse html
			const html = await requestUrl({
				method: 'GET',
				url: copied,
			});

			const hostname = url.parse(copied).hostname || '';
			const doc = new DOMParser().parseFromString(html.text, 'text/html');
			const text = extractReadable({
				doc,
				hostname,
				resultDir: readingDir,
			});
			const { readable, title, images } = text;

			// Convert to markdown
			let turndownService = new TurndownService({
				codeBlockStyle: 'fenced',
			});
			let markdown =
				turndownService.turndown(readable!)
					.replace(/\!\$\\\[\\\[/g, '![[')
					.replace(/\\\]\\\]\$/g, ']]');

			const notePath = `${readingDir}/${title}/${title}.md`;

			await createFolderGracefully(this.app.vault, dirname(notePath));
			await this.app.vault.create(notePath, markdown);
			new Notice(`Created ${title}`);

			// Download & save images
			const imageDir = `${readingDir}/${title}/images`;
			await createFolderGracefully(this.app.vault, imageDir);

			images.forEach(async imgPath => {
				const imgUrl = `https://${hostname}/${imgPath}`;
				let imgData = await requestUrl({
					method: 'GET',
					url: imgUrl,
				});

				let counter = 0;
				while (imgData.status !== 200) {
					await sleep(5000);
					console.log(`Failed to download ${imgUrl}`);
					imgData = await requestUrl({
						method: 'GET',
						url: imgUrl,
					});
					counter++;

					if (counter > 3) {
						new Notice(`Failed to download ${imgUrl}`);
						break;
					}
				}

				await sleep(1000);

				const vaultImgPath = `${imageDir}/${imgPath}`;
				await createFolderGracefully(this.app.vault, dirname(vaultImgPath));
				await this.app.vault.createBinary(vaultImgPath, imgData.arrayBuffer);
			})
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
