import { EditorHistory } from './editorHistory.js';
import { clamp, canvasToBlob, blobToDataURL, dataURLToImage, createFileFromBlob } from './editorUtils.js';

export class ImageEditor {
    constructor(elements, options = {}) {
        this.el = elements;
        this.options = options;
        this.history = new EditorHistory(30);
        this.image = null; this.originalFile = null; this.baseDataURL = null;
        this.rotation = 0; this.flipX = false; this.flipY = false; this.scale = 1;
        this.filters = { brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0, blur: 0 };
        this.text = []; this.elements = []; this.crop = null; this.cropActive = false; this.dragging = false; this.cropStart = null;
        this.initCanvasEvents();
    }

    async load(file) {
        this.originalFile = file;
        this.baseDataURL = await blobToDataURL(file);
        this.image = await dataURLToImage(this.baseDataURL);
        this.resetState(); this.history.clear(); this.history.push(this.snapshot()); this.render();
    }
    resetState() {
        this.rotation = 0; this.flipX = false; this.flipY = false; this.scale = 1;
        this.filters = { brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0, blur: 0 };
        this.text = []; this.elements = []; this.crop = null; this.cropActive = false;
    }
    snapshot() { return { baseDataURL: this.baseDataURL, rotation: this.rotation, flipX: this.flipX, flipY: this.flipY, scale: this.scale, filters: { ...this.filters }, text: structuredClone(this.text), elements: structuredClone(this.elements), crop: this.crop ? { ...this.crop } : null }; }
    async restore(s) {
        this.baseDataURL = s.baseDataURL; this.image = await dataURLToImage(this.baseDataURL);
        this.rotation = s.rotation; this.flipX = s.flipX; this.flipY = s.flipY; this.scale = s.scale;
        this.filters = { ...s.filters }; this.text = structuredClone(s.text); this.elements = structuredClone(s.elements); this.crop = s.crop ? { ...s.crop } : null;
        this.cropActive = false; this.render();
    }
    commit() { this.history.push(this.snapshot()); this.render(); this.changed(); }
    changed() { this.options.onChange?.(this.canUndo(), this.canRedo()); }
    async undo() { const s = this.history.undo(); if (s) await this.restore(s); this.changed(); }
    async redo() { const s = this.history.redo(); if (s) await this.restore(s); this.changed(); }
    canUndo() { return this.history.canUndo(); } canRedo() { return this.history.canRedo(); }

    getOutputSize() {
        const a = ((this.rotation % 360) + 360) % 360, q = a === 90 || a === 270;
        return { width: Math.max(1, Math.round((q ? this.image.height : this.image.width) * this.scale)), height: Math.max(1, Math.round((q ? this.image.width : this.image.height) * this.scale)) };
    }
    getFilterString() {
        const f = this.filters;
        return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) grayscale(${f.grayscale}%) sepia(${f.sepia}%) blur(${f.blur}px)`;
    }
    render() {
        if (!this.image) return;
        const canvas = this.el.canvas, ctx = canvas.getContext('2d'), size = this.getOutputSize();
        canvas.width = size.width; canvas.height = size.height; ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(this.rotation * Math.PI / 180); ctx.scale(this.flipX ? -1 : 1, this.flipY ? -1 : 1); ctx.filter = this.getFilterString();
        const w = this.image.width * this.scale, h = this.image.height * this.scale; ctx.drawImage(this.image, -w / 2, -h / 2, w, h); ctx.restore(); ctx.filter = 'none';
        this.drawOverlays(ctx); this.updateCropOverlay(); this.el.dimensions.textContent = `${canvas.width} × ${canvas.height}px`;
    }
    drawOverlays(ctx) {
        for (const item of this.text) {
            ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.rotation || 0); ctx.font = `${item.weight} ${item.size}px ${item.font}`; ctx.fillStyle = item.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            if (item.stroke) { ctx.lineWidth = Math.max(2, item.size / 10); ctx.strokeStyle = item.stroke; ctx.strokeText(item.value, 0, 0); } ctx.fillText(item.value, 0, 0); ctx.restore();
        }
        for (const item of this.elements) {
            ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.rotation || 0); ctx.fillStyle = item.fill; ctx.strokeStyle = item.stroke || item.fill; ctx.lineWidth = item.lineWidth || 4;
            if (item.type === 'circle') { ctx.beginPath(); ctx.arc(0, 0, item.size / 2, 0, Math.PI * 2); ctx.fill(); }
            else if (item.type === 'rectangle') ctx.fillRect(-item.size / 2, -item.size / 2, item.size, item.size);
            else if (item.type === 'star') this.drawStar(ctx, item.size / 2, 5);
            else if (item.type === 'heart') this.drawHeart(ctx, item.size);
            else if (item.type === 'emoji') { ctx.font = `${item.size}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(item.value, 0, 0); }
            ctx.restore();
        }
    }
    drawStar(ctx, radius, points) { ctx.beginPath(); for (let i = 0; i < points * 2; i++) { const r = i % 2 === 0 ? radius : radius * .45, a = -Math.PI / 2 + i * Math.PI / points, x = Math.cos(a) * r, y = Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill(); }
    drawHeart(ctx, size) { const s = size / 2; ctx.beginPath(); ctx.moveTo(0, s); ctx.bezierCurveTo(-s * 1.2, s * .2, -s, -s * .7, -s * .45, -s * .65); ctx.bezierCurveTo(-s * .15, -s * .65, 0, -s * .4, 0, -.12 * s); ctx.bezierCurveTo(0, -s * .4, s * .15, -s * .65, s * .45, -s * .65); ctx.bezierCurveTo(s, -s * .7, s * 1.2, s * .2, 0, s); ctx.closePath(); ctx.fill(); }

    rotate(degrees) { this.rotation = (this.rotation + degrees) % 360; this.commit(); }
    flip(axis) { axis === 'x' ? this.flipX = !this.flipX : this.flipY = !this.flipY; this.commit(); }
    applyFilter(name, value) { if (!(name in this.filters)) return; this.filters[name] = Number(value); this.render(); }

    async commitCurrentToBase(targetWidth = null, targetHeight = null) {
        const source = this.renderToCanvas(), output = document.createElement('canvas'); output.width = targetWidth || source.width; output.height = targetHeight || source.height;
        output.getContext('2d').drawImage(source, 0, 0, output.width, output.height);
        this.baseDataURL = output.toDataURL('image/jpeg', .92); this.image = await dataURLToImage(this.baseDataURL); this.resetState(); this.history.push(this.snapshot()); this.render(); this.changed();
    }
    async commitFilters() { await this.commitCurrentToBase(); }
    async resize(width, height) { width = Math.round(Number(width)); height = Math.round(Number(height)); if (!Number.isFinite(width) || !Number.isFinite(height) || width < 20 || height < 20 || width > 8000 || height > 8000) throw new Error('Dimensions invalides. Utilisez une valeur entre 20 et 8000 pixels.'); await this.commitCurrentToBase(width, height); }
    async addText(value, options = {}) {
        value = String(value || '').trim(); if (!value) throw new Error('Le texte ne peut pas être vide.');
        this.text.push({ value, x: this.el.canvas.width / 2, y: this.el.canvas.height / 2, size: Number(options.size) || Math.max(24, Math.round(this.el.canvas.width / 20)), color: options.color || '#ffffff', stroke: options.stroke || '#000000', weight: 'bold', font: 'Arial', rotation: 0 });
        await this.commitCurrentToBase();
    }
    async addElement(type, options = {}) {
        const allowed = ['circle', 'rectangle', 'star', 'heart', 'emoji']; if (!allowed.includes(type)) throw new Error('Élément inconnu.');
        this.elements.push({ type, value: options.value || '✨', x: this.el.canvas.width / 2, y: this.el.canvas.height / 2, size: Number(options.size) || Math.max(48, Math.round(this.el.canvas.width / 10)), fill: options.fill || '#d83ca9', stroke: '#ffffff', lineWidth: 4, rotation: 0 });
        await this.commitCurrentToBase();
    }

    startCrop() { this.cropActive = true; this.el.canvas.classList.add('editor-cropping'); this.el.cropHint.textContent = 'Tracez une zone sur l’image puis cliquez sur Valider.'; }
    cancelCrop() { this.cropActive = false; this.crop = null; this.cropStart = null; this.el.canvas.classList.remove('editor-cropping'); this.el.cropOverlay.hidden = true; }
    pointerToCanvas(e) { const r = this.el.canvas.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) * this.el.canvas.width / r.width, 0, this.el.canvas.width), y: clamp((e.clientY - r.top) * this.el.canvas.height / r.height, 0, this.el.canvas.height) }; }
    updateCropOverlay() {
        if (!this.cropActive || !this.crop) { this.el.cropOverlay.hidden = true; return; }
        const r = this.el.canvas.getBoundingClientRect(), p = this.el.canvas.parentElement.getBoundingClientRect(), sx = r.width / this.el.canvas.width, sy = r.height / this.el.canvas.height;
        Object.assign(this.el.cropOverlay.style, { left: `${r.left - p.left + this.crop.x * sx}px`, top: `${r.top - p.top + this.crop.y * sy}px`, width: `${this.crop.width * sx}px`, height: `${this.crop.height * sy}px` }); this.el.cropOverlay.hidden = false;
    }
    initCanvasEvents() {
        const c = this.el.canvas;
        c.addEventListener('pointerdown', e => { if (!this.cropActive) return; e.preventDefault(); this.cropStart = this.pointerToCanvas(e); this.crop = { x: this.cropStart.x, y: this.cropStart.y, width: 0, height: 0 }; this.dragging = true; c.setPointerCapture?.(e.pointerId); });
        c.addEventListener('pointermove', e => { if (!this.dragging) return; const p = this.pointerToCanvas(e), s = this.cropStart; this.crop = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), width: Math.abs(p.x - s.x), height: Math.abs(p.y - s.y) }; this.updateCropOverlay(); });
        const end = e => { if (!this.dragging) return; this.dragging = false; c.releasePointerCapture?.(e.pointerId); }; c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    }
    async applyCrop() {
        if (!this.crop || this.crop.width < 10 || this.crop.height < 10) throw new Error('Sélection de recadrage trop petite.');
        const source = this.renderToCanvas(), c = this.crop, output = document.createElement('canvas'); output.width = Math.round(c.width); output.height = Math.round(c.height);
        output.getContext('2d').drawImage(source, Math.round(c.x), Math.round(c.y), Math.round(c.width), Math.round(c.height), 0, 0, output.width, output.height);
        this.baseDataURL = output.toDataURL('image/jpeg', .92); this.image = await dataURLToImage(this.baseDataURL); this.resetState(); this.history.push(this.snapshot()); this.render(); this.changed();
    }
    renderToCanvas() { const c = document.createElement('canvas'); c.width = this.el.canvas.width; c.height = this.el.canvas.height; c.getContext('2d').drawImage(this.el.canvas, 0, 0); return c; }
    async exportFile() { return createFileFromBlob(await canvasToBlob(this.renderToCanvas(), 'image/jpeg', .92), this.originalFile?.name || 'photo'); }
    async reset() { this.baseDataURL = await blobToDataURL(this.originalFile); this.image = await dataURLToImage(this.baseDataURL); this.resetState(); this.history.clear(); this.history.push(this.snapshot()); this.render(); this.changed(); }
}
