var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};

// main.ts
__export(exports, {
  default: () => ImageGenerator
});
var import_obsidian = __toModule(require("obsidian"));
var DEFAULT_SETTINGS = {
  replicateApiToken: "",
  defaultWidth: 1024,
  defaultHeight: 400
};
var ImageGenerator = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "generate-image",
      name: "Generate Image",
      editorCallback: (editor, view) => {
        this.handleImageGeneration(editor);
      }
    });
    this.addSettingTab(new ImageGeneratorSettingTab(this.app, this));
  }
  async handleImageGeneration(editor) {
    if (!this.settings.replicateApiToken?.trim()) {
      new import_obsidian.Notice("\u26A0\uFE0F Veuillez configurer votre token API Replicate dans les param\xE8tres du plugin");
      this.app.setting.open();
      return;
    }
    new ImagePromptModal(this.app, this.settings, async (prompt, width, height) => {
      await this.generateAndInsertImage(prompt, editor, width, height);
    }).open();
  }
  async generateAndInsertImage(prompt, editor, width, height) {
    try {
      new import_obsidian.Notice("\u{1F3A8} G\xE9n\xE9ration de l'image en cours...");
      await this.ensureImagesFolder();
      const imageUrl = await this.generateImage(prompt, width, height);
      if (!imageUrl) {
        throw new Error("\xC9chec de la g\xE9n\xE9ration de l'image");
      }
      const savedImagePath = await this.saveImage(imageUrl);
      editor.replaceSelection(`![${prompt}](${savedImagePath})`);
      new import_obsidian.Notice("\u2705 Image g\xE9n\xE9r\xE9e et ins\xE9r\xE9e avec succ\xE8s");
    } catch (error) {
      console.error("Erreur lors de la g\xE9n\xE9ration de l'image:", error);
      new import_obsidian.Notice("\u274C Erreur lors de la g\xE9n\xE9ration de l'image. V\xE9rifiez la console pour plus de d\xE9tails.");
    }
  }
  async ensureImagesFolder() {
    const imagesDir = "images";
    if (!await this.app.vault.adapter.exists(imagesDir)) {
      await this.app.vault.createFolder(imagesDir);
    }
  }
  async generateImage(prompt, width, height) {
    try {
      const prediction = await (0, import_obsidian.requestUrl)({
        url: "https://api.replicate.com/v1/predictions",
        method: "POST",
        headers: {
          "Authorization": `Token ${this.settings.replicateApiToken}`,
          "Content-Type": "application/json"
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
        const status = await (0, import_obsidian.requestUrl)({
          url: `https://api.replicate.com/v1/predictions/${predictionData.id}`,
          method: "GET",
          headers: {
            "Authorization": `Token ${this.settings.replicateApiToken}`,
            "Content-Type": "application/json"
          }
        });
        const statusData = status.json;
        if (statusData.status === "succeeded") {
          return statusData.output?.[0] || null;
        }
        if (statusData.status === "failed") {
          throw new Error(statusData.error || "La g\xE9n\xE9ration a \xE9chou\xE9");
        }
        await new Promise((resolve) => setTimeout(resolve, 2e3));
      }
      throw new Error("Timeout: la g\xE9n\xE9ration a pris trop de temps");
    } catch (error) {
      console.error("Erreur API Replicate:", error);
      throw error;
    }
  }
  async saveImage(imageUrl) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `generated-image-${timestamp}.png`;
    const imagePath = `images/${filename}`;
    try {
      const response = await (0, import_obsidian.requestUrl)({
        url: imageUrl,
        method: "GET"
      });
      const buffer = response.arrayBuffer;
      await this.app.vault.adapter.writeBinary(imagePath, buffer);
      return imagePath;
    } catch (error) {
      console.error("Erreur lors du t\xE9l\xE9chargement de l'image:", error);
      throw new Error("Impossible de t\xE9l\xE9charger l'image g\xE9n\xE9r\xE9e");
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  onunload() {
    console.log("D\xE9chargement du plugin Image Generator");
  }
};
var ImagePromptModal = class extends import_obsidian.Modal {
  constructor(app, settings, onSubmit) {
    super(app);
    this.settings = settings;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "G\xE9n\xE9rer une image" });
    const inputsContainer = contentEl.createDiv({ cls: "modal-input-container" });
    this.promptInput = inputsContainer.createEl("textarea", {
      attr: {
        placeholder: "D\xE9crivez l'image que vous souhaitez g\xE9n\xE9rer...",
        rows: "4"
      }
    });
    const dimensionsContainer = inputsContainer.createDiv({
      cls: "dimensions-container",
      attr: {
        style: "display: flex; gap: 10px; margin-top: 10px;"
      }
    });
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
    const buttonContainer = contentEl.createDiv({
      cls: "modal-button-container",
      attr: {
        style: "display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;"
      }
    });
    const generateButton = buttonContainer.createEl("button", {
      text: "G\xE9n\xE9rer",
      cls: "mod-cta"
    });
    const cancelButton = buttonContainer.createEl("button", {
      text: "Annuler"
    });
    generateButton.onclick = this.handleGenerate.bind(this);
    cancelButton.onclick = () => this.close();
    this.promptInput.focus();
  }
  handleGenerate() {
    const prompt = this.promptInput.value.trim();
    const width = parseInt(this.widthInput.value) || this.settings.defaultWidth;
    const height = parseInt(this.heightInput.value) || this.settings.defaultHeight;
    if (!prompt) {
      new import_obsidian.Notice("\u26A0\uFE0F Veuillez entrer une description");
      return;
    }
    if (width < 64 || width > 2048 || height < 64 || height > 2048) {
      new import_obsidian.Notice("\u26A0\uFE0F Les dimensions doivent \xEAtre comprises entre 64 et 2048 pixels");
      return;
    }
    this.onSubmit(prompt, width, height);
    this.close();
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
var ImageGeneratorSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Param\xE8tres du g\xE9n\xE9rateur d'images" });
    new import_obsidian.Setting(containerEl).setName("Token API Replicate").setDesc("Entrez votre token API Replicate").addText((text) => text.setPlaceholder("Entrez votre token").setValue(this.plugin.settings.replicateApiToken).onChange(async (value) => {
      this.plugin.settings.replicateApiToken = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Largeur par d\xE9faut").setDesc("Largeur par d\xE9faut des images g\xE9n\xE9r\xE9es (en pixels)").addText((text) => text.setPlaceholder("1024").setValue(this.plugin.settings.defaultWidth.toString()).onChange(async (value) => {
      const width = parseInt(value);
      if (width >= 64 && width <= 2048) {
        this.plugin.settings.defaultWidth = width;
        await this.plugin.saveSettings();
      }
    }));
    new import_obsidian.Setting(containerEl).setName("Hauteur par d\xE9faut").setDesc("Hauteur par d\xE9faut des images g\xE9n\xE9r\xE9es (en pixels)").addText((text) => text.setPlaceholder("400").setValue(this.plugin.settings.defaultHeight.toString()).onChange(async (value) => {
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
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
