// main.ts
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { join } from 'path';
import * as replicate from 'replicate';

interface ImageGeneratorSettings {
	replicateApiToken: string;
}

const DEFAULT_SETTINGS: ImageGeneratorSettings = {
	replicateApiToken: ''
}

export default class ImageGeneratorPlugin extends Plugin {
	settings: ImageGeneratorSettings;

	async onload() {
		await this.loadSettings();

		// Ajouter une commande pour générer une image
		this.addCommand({
			id: 'generate-image',
			name: 'Generate and Insert Image',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new ImagePromptModal(this.app, this, (result) => {
					this.generateAndInsertImage(result, editor, view);
				}).open();
			}
		});

		// Ajouter l'onglet de paramètres
		this.addSettingTab(new ImageGeneratorSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async generateAndInsertImage(prompt: string, editor: Editor, view: MarkdownView) {
		try {
			if (!this.settings.replicateApiToken) {
				new Notice('Please set your Replicate API token in the settings');
				return;
			}

			new Notice('Generating image...');

			// Configurer l'API Replicate
			process.env.REPLICATE_API_TOKEN = this.settings.replicateApiToken;

			// Générer l'image
			const output = await replicate.run(
				"black-forest-labs/flux-dev",
				{
					input: { prompt: prompt }
				}
			);

			if (!output || !Array.isArray(output) || output.length === 0) {
				new Notice('Failed to generate image');
				return;
			}

			// Créer le dossier images s'il n'existe pas
			const vault = this.app.vault;
			const imagesDir = 'images';
			if (!(await vault.adapter.exists(imagesDir))) {
				await vault.createFolder(imagesDir);
			}

			// Générer un nom de fichier unique
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const filename = `generated-image-${timestamp}.png`;
			const imagePath = join(imagesDir, filename);

			// Télécharger et sauvegarder l'image
			const response = await fetch(output[0]);
			const buffer = await response.arrayBuffer();
			await vault.adapter.writeBinary(imagePath, buffer);

			// Insérer le lien de l'image dans la note
			const imageMarkdown = `![Generated Image](${imagePath})`;
			editor.replaceSelection(imageMarkdown);

			new Notice('Image generated and inserted successfully');
		} catch (error) {
			console.error('Error generating image:', error);
			new Notice('Error generating image. Check the console for details.');
		}
	}
}

class ImagePromptModal extends Modal {
	onSubmit: (result: string) => void;
	prompt: string;

	constructor(app: App, plugin: ImageGeneratorPlugin, onSubmit: (result: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Enter Image Prompt" });

		const promptInput = contentEl.createEl("input", {
			type: "text",
			placeholder: "Describe the image you want to generate..."
		});
		promptInput.style.width = "100%";
		promptInput.style.marginBottom = "1rem";

		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.gap = "1rem";

		const submitButton = buttonContainer.createEl("button", { text: "Generate" });
		const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });

		submitButton.addEventListener("click", () => {
			this.onSubmit(promptInput.value);
			this.close();
		});

		cancelButton.addEventListener("click", () => {
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ImageGeneratorSettingTab extends PluginSettingTab {
	plugin: ImageGeneratorPlugin;

	constructor(app: App, plugin: ImageGeneratorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Image Generator Settings' });

		new Setting(containerEl)
			.setName('Replicate API Token')
			.setDesc('Enter your Replicate API token')
			.addText(text => text
				.setPlaceholder('Enter your token')
				.setValue(this.plugin.settings.replicateApiToken)
				.onChange(async (value) => {
					this.plugin.settings.replicateApiToken = value;
					await this.plugin.saveSettings();
				}));
	}
}
