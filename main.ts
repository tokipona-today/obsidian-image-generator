import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl } from "obsidian";

interface ImageGeneratorSettings {
    replicateApiToken: string;
    defaultWidth: number;
    defaultHeight: number;
}

const DEFAULT_SETTINGS: ImageGeneratorSettings = {
    replicateApiToken: '',
    defaultWidth: 1024,
    defaultHeight: 400
}

export default class ImageGenerator extends Plugin {
    settings: ImageGeneratorSettings;

    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: "generate-image",
            name: "Generate Image",
            editorCallback: (editor: Editor, view: MarkdownView) => {
                this.handleImageGeneration(editor);
            }
        });

        this.addSettingTab(new ImageGeneratorSettingTab(this.app, this));
    }

    private async handleImageGeneration(editor: Editor) {
        if (!this.settings.replicateApiToken?.trim()) {
            new Notice("⚠️ Veuillez configurer votre token API Replicate dans les paramètres du plugin");
            this.app.setting.open();
            return;
        }

        new ImagePromptModal(this.app, this.settings, async (prompt, width, height) => {
            await this.generateAndInsertImage(prompt, editor, width, height);
        }).open();
    }

    private async generateAndInsertImage(prompt: string, editor: Editor, width: number, height: number) {
        try {
            new Notice("🎨 Génération de l'image en cours...");

            await this.ensureImagesFolder();

            const imageUrl = await this.generateImage(prompt, width, height);
            if (!imageUrl) {
                throw new Error("Échec de la génération de l'image");
            }

            const savedImagePath = await this.saveImage(imageUrl);

            editor.replaceSelection(`![${prompt}](${savedImagePath})`);
            new Notice("✅ Image générée et insérée avec succès");

        } catch (error) {
            console.error("Erreur lors de la génération de l'image:", error);
            new Notice("❌ Erreur lors de la génération de l'image. Vérifiez la console pour plus de détails.");
        }
    }

    private async ensureImagesFolder(): Promise<void> {
        const imagesDir = 'images';
        if (!(await this.app.vault.adapter.exists(imagesDir))) {
            await this.app.vault.createFolder(imagesDir);
        }
    }

    private async generateImage(prompt: string, width: number, height: number): Promise<string | null> {
        try {
            const prediction = await requestUrl({
                url: "https://api.replicate.com/v1/predictions",
                method: "POST",
                headers: {
                    "Authorization": `Token ${this.settings.replicateApiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
                    input: {
                        prompt,
                        width,
                        height
                    }
                })
            });

            const predictionData = prediction.json;

            for (let i = 0; i < 30; i++) {
                const status = await requestUrl({
                    url: `https://api.replicate.com/v1/predictions/${predictionData.id}`,
                    method: "GET",
                    headers: {
                        "Authorization": `Token ${this.settings.replicateApiToken}`,
                        "Content-Type": "application/json",
                    }
                });

                const statusData = status.json;

                if (statusData.status === "succeeded") {
                    return statusData.output?.[0] || null;
                }

                if (statusData.status === "failed") {
                    throw new Error(statusData.error || "La génération a échoué");
                }

                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            throw new Error("Timeout: la génération a pris trop de temps");
        } catch (error) {
            console.error("Erreur API Replicate:", error);
            throw error;
        }
    }

    private async saveImage(imageUrl: string): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `generated-image-${timestamp}.png`;
        const imagePath = `images/${filename}`;

        try {
            const response = await requestUrl({
                url: imageUrl,
                method: "GET"
            });

            const buffer = response.arrayBuffer;
            await this.app.vault.adapter.writeBinary(imagePath, buffer);

            return imagePath;
        } catch (error) {
            console.error("Erreur lors du téléchargement de l'image:", error);
            throw new Error("Impossible de télécharger l'image générée");
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        console.log("Déchargement du plugin Image Generator");
    }
}

class ImagePromptModal extends Modal {
    private onSubmit: (result: string, width: number, height: number) => void;
    private promptInput: HTMLTextAreaElement;
    private widthInput: HTMLInputElement;
    private heightInput: HTMLInputElement;
    private settings: ImageGeneratorSettings;

    constructor(app: App, settings: ImageGeneratorSettings, onSubmit: (result: string, width: number, height: number) => void) {
        super(app);
        this.settings = settings;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Générer une image" });

        // Container pour tous les inputs
        const inputsContainer = contentEl.createDiv({ cls: "modal-input-container" });

        // Description
        this.promptInput = inputsContainer.createEl("textarea", {
            attr: {
                placeholder: "Décrivez l'image que vous souhaitez générer...",
                rows: "4"
            }
        });

        // Container pour les dimensions
        const dimensionsContainer = inputsContainer.createDiv({
            cls: "dimensions-container",
            attr: {
                style: "display: flex; gap: 10px; margin-top: 10px;"
            }
        });

        // Input Largeur
        const widthContainer = dimensionsContainer.createDiv();
        widthContainer.createEl("label", { text: "Largeur" });
        this.widthInput = widthContainer.createEl("input", {
            type: "number",
            attr: {
                value: this.settings.defaultWidth.toString(),
                min: "64",
                max: "2048",
                style: "width: 100px;"
            }
        });

        // Input Hauteur
        const heightContainer = dimensionsContainer.createDiv();
        heightContainer.createEl("label", { text: "Hauteur" });
        this.heightInput = heightContainer.createEl("input", {
            type: "number",
            attr: {
                value: this.settings.defaultHeight.toString(),
                min: "64",
                max: "2048",
                style: "width: 100px;"
            }
        });

        // Conteneur des boutons
        const buttonContainer = contentEl.createDiv({
            cls: "modal-button-container",
            attr: {
                style: "display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;"
            }
        });

        const generateButton = buttonContainer.createEl("button", {
            text: "Générer",
            cls: "mod-cta"
        });

        const cancelButton = buttonContainer.createEl("button", {
            text: "Annuler"
        });

        generateButton.onclick = this.handleGenerate.bind(this);
        cancelButton.onclick = () => this.close();

        this.promptInput.focus();
    }

    private handleGenerate() {
        const prompt = this.promptInput.value.trim();
        const width = parseInt(this.widthInput.value) || this.settings.defaultWidth;
        const height = parseInt(this.heightInput.value) || this.settings.defaultHeight;

        if (!prompt) {
            new Notice("⚠️ Veuillez entrer une description");
            return;
        }

        // Vérification des dimensions
        if (width < 64 || width > 2048 || height < 64 || height > 2048) {
            new Notice("⚠️ Les dimensions doivent être comprises entre 64 et 2048 pixels");
            return;
        }

        this.onSubmit(prompt, width, height);
        this.close();
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

class ImageGeneratorSettingTab extends PluginSettingTab {
    plugin: ImageGenerator;

    constructor(app: App, plugin: ImageGenerator) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        containerEl.createEl("h2", {text: "Paramètres du générateur d'images"});

        new Setting(containerEl)
            .setName("Token API Replicate")
            .setDesc("Entrez votre token API Replicate")
            .addText(text => text
                .setPlaceholder("Entrez votre token")
                .setValue(this.plugin.settings.replicateApiToken)
                .onChange(async (value) => {
                    this.plugin.settings.replicateApiToken = value.trim();
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Largeur par défaut")
            .setDesc("Largeur par défaut des images générées (en pixels)")
            .addText(text => text
                .setPlaceholder("1024")
                .setValue(this.plugin.settings.defaultWidth.toString())
                .onChange(async (value) => {
                    const width = parseInt(value);
                    if (width >= 64 && width <= 2048) {
                        this.plugin.settings.defaultWidth = width;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName("Hauteur par défaut")
            .setDesc("Hauteur par défaut des images générées (en pixels)")
            .addText(text => text
                .setPlaceholder("400")
                .setValue(this.plugin.settings.defaultHeight.toString())
                .onChange(async (value) => {
                    const height = parseInt(value);
                    if (height >= 64 && height <= 2048) {
                        this.plugin.settings.defaultHeight = height;
                        await this.plugin.saveSettings();
                    }
                }));

        containerEl.createEl("p", {
            text: "Pour obtenir votre token API Replicate, visitez : "
        }).createEl("a", {
            text: "https://replicate.com/account",
            href: "https://replicate.com/account"
        });
    }
}
