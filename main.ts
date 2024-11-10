import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl } from "obsidian";

interface ReplicateModel {
    id: string;
    name: string;
    version: string;
    description: string;
}

const AVAILABLE_MODELS: ReplicateModel[] = [
    {
        id: "flux-schnell",
        name: "Flux Schnell",
        version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        description: "Rapide et efficace"
    },
    {
        id: "flux-dev",
        name: "Flux Dev",
        version: "565461599b5f9b3c66881283fa040b770880c0c4bfa25dee269923b2c3d48e13",
        description: "Version de développement"
    },
    {
        id: "flux-pro",
        name: "Flux Pro",
        version: "8acdb09559e65c59da7973c1b1142a318b28cf93c56614bf4145175061339378",
        description: "Version professionnelle haute qualité"
    }
] as const;

interface ImageGeneratorSettings {
    replicateApiToken: string;
    defaultWidth: number;
    defaultHeight: number;
    defaultModel: string;
}

const DEFAULT_SETTINGS: Readonly<ImageGeneratorSettings> = {
    replicateApiToken: '',
    defaultWidth: 1024,
    defaultHeight: 400,
    defaultModel: AVAILABLE_MODELS[0].id
};

const IMAGES_DIR = 'images';
const MAX_POLLING_ATTEMPTS = 30;
const POLLING_INTERVAL = 2000;
const DIMENSION_CONSTRAINTS = {
    min: 64,
    max: 2048
} as const;

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
        if (!this.validateApiToken()) {
            return;
        }

        new ImagePromptModal(this.app, this.settings, async (prompt, width, height, modelId) => {
            await this.generateAndInsertImage(prompt, editor, width, height, modelId);
        }).open();
    }

    private validateApiToken(): boolean {
        if (!this.settings.replicateApiToken?.trim()) {
            new Notice("⚠️ Veuillez configurer votre token API Replicate dans les paramètres du plugin");
            this.app.setting.open();
            return false;
        }
        return true;
    }

    private async generateAndInsertImage(
        prompt: string,
        editor: Editor,
        width: number,
        height: number,
        modelId: string
    ) {
        try {
            new Notice("🎨 Génération de l'image en cours...");

            await this.ensureImagesFolder();

            const imageUrl = await this.generateImage(prompt, width, height, modelId);
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
        if (!(await this.app.vault.adapter.exists(IMAGES_DIR))) {
            await this.app.vault.createFolder(IMAGES_DIR);
        }
    }

    private async generateImage(
        prompt: string,
        width: number,
        height: number,
        modelId: string
    ): Promise<string | null> {
        try {
            const prediction = await this.createPrediction(prompt, width, height, modelId);
            return await this.pollPredictionStatus(prediction.id);
        } catch (error) {
            console.error("Replicate API Error:", error);
            throw error;
        }
    }

    private async createPrediction(prompt: string, width: number, height: number, modelId: string) {
        const model = AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];

        const response = await requestUrl({
            url: "https://api.replicate.com/v1/predictions",
            method: "POST",
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
                version: model.version,
                input: { prompt, width, height }
            })
        });
        return response.json;
    }

    private async pollPredictionStatus(predictionId: string): Promise<string | null> {
        for (let i = 0; i < MAX_POLLING_ATTEMPTS; i++) {
            const status = await requestUrl({
                url: `https://api.replicate.com/v1/predictions/${predictionId}`,
                method: "GET",
                headers: this.getAuthHeaders()
            });

            const statusData = status.json;

            if (statusData.status === "succeeded") {
                return statusData.output?.[0] || null;
            }

            if (statusData.status === "failed") {
                throw new Error(statusData.error || "La génération a échoué");
            }

            await this.delay(POLLING_INTERVAL);
        }

        throw new Error("Timeout: la génération a pris trop de temps");
    }

    private getAuthHeaders() {
        return {
            "Authorization": `Token ${this.settings.replicateApiToken}`,
            "Content-Type": "application/json",
        };
    }

    private async saveImage(imageUrl: string): Promise<string> {
        const filename = this.generateImageFilename();
        const imagePath = `${IMAGES_DIR}/${filename}`;

        try {
            const response = await requestUrl({
                url: imageUrl,
                method: "GET"
            });

            await this.app.vault.adapter.writeBinary(imagePath, response.arrayBuffer);
            return imagePath;
        } catch (error) {
            console.error("Erreur lors du téléchargement de l'image:", error);
            throw new Error("Impossible de télécharger l'image générée");
        }
    }

    private generateImageFilename(): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `generated-image-${timestamp}.png`;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
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
    private readonly onSubmit: (
        result: string,
        width: number,
        height: number,
        modelId: string
    ) => void;
    private promptInput: HTMLTextAreaElement;
    private widthInput: HTMLInputElement;
    private heightInput: HTMLInputElement;
    private modelSelect: HTMLSelectElement;
    private readonly settings: ImageGeneratorSettings;

    constructor(
        app: App,
        settings: ImageGeneratorSettings,
        onSubmit: (result: string, width: number, height: number, modelId: string) => void
    ) {
        super(app);
        this.settings = settings;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Générer une image" });

        this.createInputs(contentEl);
        this.createButtons(contentEl);

        this.promptInput.focus();
    }

    private createInputs(containerEl: HTMLElement) {
        const inputsContainer = containerEl.createDiv({ cls: "modal-input-container" });

        this.createModelSelect(inputsContainer);
        this.promptInput = this.createPromptInput(inputsContainer);
        this.createDimensionsInputs(inputsContainer);
    }

    private createModelSelect(container: HTMLElement) {
        const modelContainer = container.createDiv({
            cls: "model-select-container",
            attr: {
                style: "margin-bottom: 12px;"
            }
        });

        modelContainer.createEl("label", {
            text: "Modèle",
            attr: {
                style: "display: block; margin-bottom: 4px;"
            }
        });

        this.modelSelect = modelContainer.createEl("select", {
            cls: "dropdown",
            attr: {
                style: "width: 100%; padding: 6px;"
            }
        });

        AVAILABLE_MODELS.forEach(model => {
            const option = this.modelSelect.createEl("option", {
                text: `${model.name} - ${model.description}`,
                value: model.id
            });

            if (model.id === this.settings.defaultModel) {
                option.selected = true;
            }
        });
    }

    private createPromptInput(container: HTMLElement): HTMLTextAreaElement {
        const promptContainer = container.createDiv({
            attr: {
                style: "margin-bottom: 12px;"
            }
        });

        promptContainer.createEl("label", {
            text: "Description",
            attr: {
                style: "display: block; margin-bottom: 4px;"
            }
        });

        return promptContainer.createEl("textarea", {
            attr: {
                placeholder: "Décrivez l'image que vous souhaitez générer...",
                rows: "4",
                style: "width: 100%;"
            }
        });
    }

    private createDimensionsInputs(container: HTMLElement) {
        const dimensionsContainer = container.createDiv({
            cls: "dimensions-container",
            attr: {
                style: "display: flex; gap: 10px; margin-top: 10px;"
            }
        });

        this.widthInput = this.createDimensionInput(
            dimensionsContainer,
            "Largeur",
            this.settings.defaultWidth
        );

        this.heightInput = this.createDimensionInput(
            dimensionsContainer,
            "Hauteur",
            this.settings.defaultHeight
        );
    }

    private createDimensionInput(container: HTMLElement, label: string, defaultValue: number): HTMLInputElement {
        const wrapper = container.createDiv();
        wrapper.createEl("label", {
            text: label,
            attr: {
                style: "display: block; margin-bottom: 4px;"
            }
        });
        return wrapper.createEl("input", {
            type: "number",
            attr: {
                value: defaultValue.toString(),
                min: DIMENSION_CONSTRAINTS.min.toString(),
                max: DIMENSION_CONSTRAINTS.max.toString(),
                style: "width: 100px;"
            }
        });
    }

    private createButtons(containerEl: HTMLElement) {
        const buttonContainer = containerEl.createDiv({
            cls: "modal-button-container",
            attr: {
                style: "display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;"
            }
        });

        buttonContainer.createEl("button", {
            text: "Générer",
            cls: "mod-cta"
        }).onclick = this.handleGenerate.bind(this);

        buttonContainer.createEl("button", {
            text: "Annuler"
        }).onclick = () => this.close();
    }

    private handleGenerate() {
        const prompt = this.promptInput.value.trim();
        const width = parseInt(this.widthInput.value) || this.settings.defaultWidth;
        const height = parseInt(this.heightInput.value) || this.settings.defaultHeight;
        const modelId = this.modelSelect.value;

        if (!this.validateInputs(prompt, width, height)) {
            return;
        }

        this.onSubmit(prompt, width, height, modelId);
        this.close();
    }

    private validateInputs(prompt: string, width: number, height: number): boolean {
        if (!prompt) {
            new Notice("⚠️ Veuillez entrer une description");
            return false;
        }

        if (!this.validateDimension(width) || !this.validateDimension(height)) {
            new Notice(`⚠️ Les dimensions doivent être comprises entre ${DIMENSION_CONSTRAINTS.min} et ${DIMENSION_CONSTRAINTS.max} pixels`);
            return false;
        }

        return true;
    }

    private validateDimension(value: number): boolean {
        return value >= DIMENSION_CONSTRAINTS.min && value <= DIMENSION_CONSTRAINTS.max;
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

        this.createSettingsUI(containerEl);
    }

    private createSettingsUI(containerEl: HTMLElement) {
        containerEl.createEl("h2", {text: "Paramètres du générateur d'images"});

        this.createApiTokenSetting(containerEl);
        this.createModelSetting(containerEl);
        this.createDimensionSettings(containerEl);
        this.createHelpText(containerEl);
    }

    private createApiTokenSetting(containerEl: HTMLElement) {
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
    }

    private createModelSetting(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName("Modèle par défaut")
            .setDesc("Sélectionnez le modèle à utiliser par défaut")
            .addDropdown(dropdown => {
                AVAILABLE_MODELS.forEach(model => {
                    dropdown.addOption(model.id, `${model.name} - ${model.description}`);
                });

                dropdown.setValue(this.plugin.settings.defaultModel);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.defaultModel = value;
                    await this.plugin.saveSettings();
                });
            });
    }
    private createDimensionSettings(containerEl: HTMLElement) {
        this.createDimensionSetting(containerEl, "Largeur par défaut", "defaultWidth");
        this.createDimensionSetting(containerEl, "Hauteur par défaut", "defaultHeight");
    }

    private createDimensionSetting(containerEl: HTMLElement, name: string, settingKey: keyof ImageGeneratorSettings) {
        new Setting(containerEl)
            .setName(name)
            .setDesc(`${name} par défaut pour les images générées (en pixels)`)
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS[settingKey].toString())
                .setValue(this.plugin.settings[settingKey].toString())
                .onChange(async (value) => {
                    const dimension = parseInt(value);
                    if (this.validateDimension(dimension)) {
                        (this.plugin.settings[settingKey] as number) = dimension;
                        await this.plugin.saveSettings();
                    }
                }));
    }

    private validateDimension(value: number): boolean {
        return value >= DIMENSION_CONSTRAINTS.min && value <= DIMENSION_CONSTRAINTS.max;
    }

    private createHelpText(containerEl: HTMLElement) {
        // Section d'aide pour les modèles
        const modelInfoEl = containerEl.createEl("div", {
            cls: "setting-item-description",
            attr: {
                style: "margin-top: 2em;"
            }
        });

        modelInfoEl.createEl("h3", { text: "Information sur les modèles disponibles" });

        const modelList = modelInfoEl.createEl("ul");
        AVAILABLE_MODELS.forEach(model => {
            const li = modelList.createEl("li");
            li.createEl("strong", { text: model.name });
            li.appendChild(document.createTextNode(` - ${model.description}`));
        });

        // Lien vers Replicate
        const helpText = containerEl.createEl("p", {
            attr: {
                style: "margin-top: 2em;"
            }
        });
        helpText.appendChild(document.createTextNode("Pour obtenir votre token API Replicate, visitez : "));
        helpText.appendChild(
            createEl("a", {
                text: "https://replicate.com/account",
                attr: {
                    href: "https://replicate.com/account",
                    target: "_blank",
                    rel: "noopener"
                }
            })
        );
    }
}
