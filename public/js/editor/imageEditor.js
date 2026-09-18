import { EditorHistory } from './editorHistory.js';
import { clamp, canvasToBlob, blobToDataURL, dataURLToImage, createFileFromBlob } from './editorUtils.js';

const STANDARD_WIDTH = 1150;
const STANDARD_HEIGHT = 628;

export class ImageEditor {
    constructor(elements, options = {}) {
        this.el = elements;
        this.options = options;
        this.history = new EditorHistory(30);
        this.image = null; this.originalFile = null; this.baseDataURL = null;
        this.rotation = 0; this.flipX = false; this.flipY = false; this.scale = 1;
        this.filters = { brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0, blur: 0 };
        this.text = []; this.elements = []; this.crop = null; this.cropActive = false; this.dragging = false; this.cropStart = null;
        this.selectedOverlay = null; this.overlayDrag = null;
        this.active = false;
        this.loadId = 0;
        this.initCanvasEvents();
    }

    setActive(active) {
        this.active = Boolean(active);
        if (!this.active) {
            this.cropActive = false;
            this.dragging = false;
            this.overlayDrag = null;
            this.el.canvas.classList.remove('editor-cropping');
            if (this.el.cropOverlay) this.el.cropOverlay.hidden = true;
        }
    }

    async load(file) {
        const loadId = ++this.loadId;
        this.originalFile = file;
        this.baseDataURL = await blobToDataURL(file);
        this.image = await dataURLToImage(this.baseDataURL);
        if (loadId !== this.loadId || this.originalFile !== file) return;
        this.resetState(); this.history.clear(); this.history.push(this.snapshot()); this.render();
    }
    resetState() {
        this.rotation = 0; this.flipX = false; this.flipY = false; this.scale = 1;
        this.filters = { brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0, blur: 0 };
        this.text = []; this.elements = []; this.crop = null; this.cropActive = false;
        this.selectedOverlay = null; this.overlayDrag = null;
    }
    snapshot() { return { baseDataURL: this.baseDataURL, rotation: this.rotation, flipX: this.flipX, flipY: this.flipY, scale: this.scale, filters: { ...this.filters }, text: structuredClone(this.text), elements: structuredClone(this.elements), crop: this.crop ? { ...this.crop } : null }; }
    async restore(s) {
        this.baseDataURL = s.baseDataURL; this.image = await dataURLToImage(this.baseDataURL);
        this.rotation = s.rotation; this.flipX = s.flipX; this.flipY = s.flipY; this.scale = s.scale;
        this.filters = { ...s.filters }; this.text = structuredClone(s.text); this.elements = structuredClone(s.elements); this.crop = s.crop ? { ...s.crop } : null;
        this.cropActive = false; this.selectedOverlay = null; this.overlayDrag = null; this.render();
    }
    commit() { this.history.push(this.snapshot()); this.render(); this.updateSelectedOverlayUI(); this.changed(); }
    changed() { this.options.onChange?.(this.canUndo(), this.canRedo()); }
    async undo() { const s = this.history.undo(); if (s) await this.restore(s); this.changed(); }
    async redo() { const s = this.history.redo(); if (s) await this.restore(s); this.changed(); }
    canUndo() { return this.history.canUndo(); } canRedo() { return this.history.canRedo(); }

    getOutputSize() {
        // Toutes les publications photo utilisent le même format de sortie.
        // L'image est ensuite ajustée à l'intérieur de cette zone sans déformation.
        return { width: STANDARD_WIDTH, height: STANDARD_HEIGHT };
    }
    getFilterString() {
        const f = this.filters;
        return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) grayscale(${f.grayscale}%) sepia(${f.sepia}%) blur(${f.blur}px)`;
    }
    render() {
        if (!this.image) return;
        const canvas = this.el.canvas;
        const ctx = canvas.getContext('2d');
        const size = this.getOutputSize();

        canvas.width = size.width;
        canvas.height = size.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fond fixe du format standard. L'image reste toujours contenue dans le cadre.
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const angle = ((this.rotation % 360) + 360) % 360;
        const quarterTurn = angle === 90 || angle === 270;
        const rotatedWidth = quarterTurn ? this.image.height : this.image.width;
        const rotatedHeight = quarterTurn ? this.image.width : this.image.height;
        const fit = Math.min(canvas.width / rotatedWidth, canvas.height / rotatedHeight);
        const drawWidth = this.image.width * fit;
        const drawHeight = this.image.height * fit;

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.scale(this.flipX ? -1 : 1, this.flipY ? -1 : 1);
        ctx.filter = this.getFilterString();
        ctx.drawImage(this.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
        ctx.filter = 'none';

        this.drawOverlays(ctx);
        this.updateCropOverlay();
        this.el.dimensions.textContent = `${canvas.width} × ${canvas.height}px — format standard`;
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
        this.drawSelection(ctx);
    }

    drawSelection(ctx) {
        const item = this.getSelectedItem();
        if (!item) return;
        const box = this.getOverlayBounds(item.kind, item.item);
        ctx.save();
        ctx.translate(item.item.x, item.item.y);
        ctx.rotate(item.item.rotation || 0);
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = 'rgba(255,255,255,.08)';
        ctx.lineWidth = Math.max(2, 3 / Math.max(this.scale, .25));
        ctx.setLineDash([8, 5]);
        ctx.strokeRect(box.x - item.item.x, box.y - item.item.y, box.width, box.height);
        ctx.setLineDash([]);
        ctx.restore();
    }

    getSelectedItem() {
        if (!this.selectedOverlay) return null;
        const list = this.selectedOverlay.kind === 'text' ? this.text : this.elements;
        const item = list[this.selectedOverlay.index];
        return item ? { kind: this.selectedOverlay.kind, index: this.selectedOverlay.index, item } : null;
    }

    getOverlayBounds(kind, item) {
        if (kind === 'text') {
            const ctx = this.el.canvas.getContext('2d');
            ctx.save();
            ctx.font = `${item.weight} ${item.size}px ${item.font}`;
            const width = Math.max(item.size, ctx.measureText(item.value).width) + item.size * .22;
            ctx.restore();
            return { x: item.x - width / 2, y: item.y - item.size * .7, width, height: item.size * 1.4 };
        }
        const padding = Math.max(10, item.size * .12);
        return { x: item.x - item.size / 2 - padding, y: item.y - item.size / 2 - padding, width: item.size + padding * 2, height: item.size + padding * 2 };
    }

    hitTestOverlay(point) {
        const candidates = [];
        this.text.forEach((item, index) => candidates.push({ kind: 'text', index, item }));
        this.elements.forEach((item, index) => candidates.push({ kind: 'element', index, item }));
        for (let i = candidates.length - 1; i >= 0; i--) {
            const candidate = candidates[i];
            const b = this.getOverlayBounds(candidate.kind, candidate.item);
            const angle = -(candidate.item.rotation || 0);
            const dx = point.x - candidate.item.x;
            const dy = point.y - candidate.item.y;
            const x = dx * Math.cos(angle) - dy * Math.sin(angle) + candidate.item.x;
            const y = dx * Math.sin(angle) + dy * Math.cos(angle) + candidate.item.y;
            if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return candidate;
        }
        return null;
    }

    selectOverlay(hit) {
        this.selectedOverlay = hit ? { kind: hit.kind, index: hit.index } : null;
        this.updateSelectedOverlayUI();
        this.render();
    }

    updateSelectedOverlayUI() {
        const selected = this.getSelectedItem();
        const hasSelection = Boolean(selected);
        this.el.selectedOverlayPanel?.toggleAttribute('hidden', !hasSelection);
        if (!selected) {
            if (this.el.selectedTextSizeRow) this.el.selectedTextSizeRow.hidden = true;
            return;
        }
        const isText = selected.kind === 'text';
        const color = isText ? selected.item.color : selected.item.fill;
        if (this.el.overlayColor) this.el.overlayColor.value = color || '#ffffff';
        if (this.el.selectedOverlayLabel) this.el.selectedOverlayLabel.textContent = isText ? 'Texte sélectionné' : 'Élément sélectionné';
        if (this.el.selectedTextSizeRow) this.el.selectedTextSizeRow.hidden = false;
        if (this.el.selectedTextSizeInput) {
            this.el.selectedTextSizeInput.value = String(selected.item.size);
            if (this.el.selectedTextSizeValue) this.el.selectedTextSizeValue.value = String(selected.item.size);
        }
    }

    setSelectedOverlaySize(size, commit = true) {
        const selected = this.getSelectedItem();
        if (!selected) return;

        const nextSize = clamp(Number(size) || selected.item.size, 16, 180);
        selected.item.size = nextSize;

        const box = this.getOverlayBounds(selected.kind, selected.item);
        selected.item.x = clamp(selected.item.x, box.width / 2, this.el.canvas.width - box.width / 2);
        selected.item.y = clamp(selected.item.y, box.height / 2, this.el.canvas.height - box.height / 2);

        this.render();
        this.updateSelectedOverlayUI();
        if (commit) {
            this.history.push(this.snapshot());
            this.changed();
        }
    }

    setSelectedTextSize(size, commit = true) {
        this.setSelectedOverlaySize(size, commit);
    }

    setSelectedColor(color) {
        const selected = this.getSelectedItem();
        if (!selected || !/^#[0-9a-f]{6}$/i.test(color)) return;
        if (selected.kind === 'text') selected.item.color = color;
        else selected.item.fill = color;
        this.commit();
        this.updateSelectedOverlayUI();
    }

    moveSelectedTo(point) {
        const selected = this.getSelectedItem();
        if (!selected) return;

        const box = this.getOverlayBounds(selected.kind, selected.item);
        const halfWidth = box.width / 2;
        const halfHeight = box.height / 2;

        // L'élément reste entièrement dans le cadre standard de la publication.
        selected.item.x = clamp(point.x, halfWidth, this.el.canvas.width - halfWidth);
        selected.item.y = clamp(point.y, halfHeight, this.el.canvas.height - halfHeight);
        this.render();
    }
    drawStar(ctx, radius, points) { ctx.beginPath(); for (let i = 0; i < points * 2; i++) { const r = i % 2 === 0 ? radius : radius * .45, a = -Math.PI / 2 + i * Math.PI / points, x = Math.cos(a) * r, y = Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill(); }
    drawHeart(ctx, size) { const s = size / 2; ctx.beginPath(); ctx.moveTo(0, s); ctx.bezierCurveTo(-s * 1.2, s * .2, -s, -s * .7, -s * .45, -s * .65); ctx.bezierCurveTo(-s * .15, -s * .65, 0, -s * .4, 0, -.12 * s); ctx.bezierCurveTo(0, -s * .4, s * .15, -s * .65, s * .45, -s * .65); ctx.bezierCurveTo(s, -s * .7, s * 1.2, s * .2, 0, s); ctx.closePath(); ctx.fill(); }

    rotate(degrees) {
        const turns = ((Math.round(degrees / 90) % 4) + 4) % 4;
        const oldWidth = this.el.canvas.width;
        const oldHeight = this.el.canvas.height;
        if (turns === 1 || turns === 3 || turns === 2) {
            const all = [...this.text, ...this.elements];
            for (const item of all) {
                const x = item.x;
                const y = item.y;
                if (turns === 1) { item.x = oldHeight - y; item.y = x; }
                else if (turns === 2) { item.x = oldWidth - x; item.y = oldHeight - y; }
                else if (turns === 3) { item.x = y; item.y = oldWidth - x; }
            }
        }
        this.rotation = (this.rotation + degrees) % 360;
        this.commit();
    }
    flip(axis) {
        const all = [...this.text, ...this.elements];
        if (axis === 'x') {
            this.flipX = !this.flipX;
            for (const item of all) item.x = this.el.canvas.width - item.x;
        } else {
            this.flipY = !this.flipY;
            for (const item of all) item.y = this.el.canvas.height - item.y;
        }
        this.commit();
    }
    applyFilter(name, value) { if (!(name in this.filters)) return; this.filters[name] = Number(value); this.render(); }

    async commitCurrentToBase() {
        // Les textes/éléments sont dessinés par render(). On fige ici exactement
        // le format standard 1150 × 628 pour la suite des retouches.
        this.render();

        const source = this.renderToCanvas();
        this.baseDataURL = source.toDataURL('image/jpeg', .92);
        this.image = await dataURLToImage(this.baseDataURL);
        this.resetState();
        this.history.push(this.snapshot());
        this.render();
        this.changed();
    }
    async commitFilters() { await this.commitCurrentToBase(); }
    addText(value, options = {}) {
        value = String(value || '').trim(); if (!value) throw new Error('Le texte ne peut pas être vide.');
        const item = { value, x: this.el.canvas.width / 2, y: this.el.canvas.height / 2, size: Number(options.size) || Math.max(24, Math.round(this.el.canvas.width / 20)), color: options.color || '#ffffff', stroke: options.stroke || '#000000', weight: 'bold', font: 'Arial', rotation: 0 };
        this.text.push(item);
        this.selectedOverlay = { kind: 'text', index: this.text.length - 1 };
        this.commit();
    }
    addElement(type, options = {}) {
        const allowed = ['circle', 'rectangle', 'star', 'heart', 'emoji']; if (!allowed.includes(type)) throw new Error('Élément inconnu.');
        const item = { type, value: options.value || '✨', x: this.el.canvas.width / 2, y: this.el.canvas.height / 2, size: Number(options.size) || Math.max(48, Math.round(this.el.canvas.width / 10)), fill: options.fill || '#d83ca9', stroke: '#ffffff', lineWidth: 4, rotation: 0 };
        this.elements.push(item);
        this.selectedOverlay = { kind: 'element', index: this.elements.length - 1 };
        this.commit();
    }

    startCrop() { this.cropActive = true; this.el.canvas.classList.add('editor-cropping'); this.el.cropHint.textContent = 'Tracez une zone sur l’image puis cliquez sur Valider.'; }
    cancelCrop() { this.cropActive = false; this.crop = null; this.cropStart = null; this.dragging = false; this.overlayDrag = null; this.el.canvas.classList.remove('editor-cropping'); this.el.cropOverlay.hidden = true; }
    pointerToCanvas(e) { const r = this.el.canvas.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) * this.el.canvas.width / r.width, 0, this.el.canvas.width), y: clamp((e.clientY - r.top) * this.el.canvas.height / r.height, 0, this.el.canvas.height) }; }
    updateCropOverlay() {
        if (!this.cropActive || !this.crop) { this.el.cropOverlay.hidden = true; return; }
        const r = this.el.canvas.getBoundingClientRect(), p = this.el.canvas.parentElement.getBoundingClientRect(), sx = r.width / this.el.canvas.width, sy = r.height / this.el.canvas.height;
        Object.assign(this.el.cropOverlay.style, { left: `${r.left - p.left + this.crop.x * sx}px`, top: `${r.top - p.top + this.crop.y * sy}px`, width: `${this.crop.width * sx}px`, height: `${this.crop.height * sy}px` }); this.el.cropOverlay.hidden = false;
    }
    initCanvasEvents() {
        const c = this.el.canvas;
        c.addEventListener('pointerdown', e => {
            if (!this.active) return;
            e.preventDefault();
            const point = this.pointerToCanvas(e);
            if (this.cropActive) {
                this.cropStart = point;
                this.crop = { x: this.cropStart.x, y: this.cropStart.y, width: 0, height: 0 };
                this.dragging = true;
                c.setPointerCapture?.(e.pointerId);
                return;
            }
            const hit = this.hitTestOverlay(point);
            this.selectOverlay(hit);
            if (hit) {
                this.overlayDrag = { pointerId: e.pointerId, kind: hit.kind, index: hit.index, offsetX: point.x - hit.item.x, offsetY: point.y - hit.item.y };
                this.dragging = true;
                c.setPointerCapture?.(e.pointerId);
            }
        });
        c.addEventListener('pointermove', e => {
            if (!this.active) return;
            const point = this.pointerToCanvas(e);
            if (this.cropActive && this.dragging) {
                const s = this.cropStart;
                this.crop = { x: Math.min(s.x, point.x), y: Math.min(s.y, point.y), width: Math.abs(point.x - s.x), height: Math.abs(point.y - s.y) };
                this.updateCropOverlay();
                return;
            }
            if (!this.overlayDrag || !this.dragging || this.overlayDrag.pointerId !== e.pointerId) return;
            const selected = this.getSelectedItem();
            if (!selected) return;
            selected.item.x = clamp(point.x - this.overlayDrag.offsetX, 0, c.width);
            selected.item.y = clamp(point.y - this.overlayDrag.offsetY, 0, c.height);
            this.render();
        });
        const end = e => {
            if (!this.active) return;
            if (this.cropActive) {
                if (!this.dragging) return;
                this.dragging = false;
                c.releasePointerCapture?.(e.pointerId);
                return;
            }
            if (!this.overlayDrag || !this.dragging || this.overlayDrag.pointerId !== e.pointerId) return;
            this.dragging = false;
            this.overlayDrag = null;
            c.releasePointerCapture?.(e.pointerId);
            this.commit();
        };
        c.addEventListener('pointerup', end);
        c.addEventListener('pointercancel', end);
        c.addEventListener('dblclick', e => {
            if (!this.active || this.cropActive) return;
            const hit = this.hitTestOverlay(this.pointerToCanvas(e));
            this.selectOverlay(hit);
        });
    }
    async applyCrop() {
        if (!this.crop || this.crop.width < 10 || this.crop.height < 10) throw new Error('Sélection de recadrage trop petite.');
        const source = this.renderToCanvas(), c = this.crop, output = document.createElement('canvas'); output.width = Math.round(c.width); output.height = Math.round(c.height);
        output.getContext('2d').drawImage(source, Math.round(c.x), Math.round(c.y), Math.round(c.width), Math.round(c.height), 0, 0, output.width, output.height);
        this.baseDataURL = output.toDataURL('image/jpeg', .92); this.image = await dataURLToImage(this.baseDataURL); this.resetState(); this.history.push(this.snapshot()); this.render(); this.changed();
    }
    renderToCanvas(includeSelection = false) {
        const previousSelection = this.selectedOverlay;
        if (!includeSelection) this.selectedOverlay = null;
        this.render();
        const c = document.createElement('canvas');
        c.width = this.el.canvas.width;
        c.height = this.el.canvas.height;
        c.getContext('2d').drawImage(this.el.canvas, 0, 0);
        this.selectedOverlay = previousSelection;
        this.render();
        return c;
    }
    async exportFile() { return createFileFromBlob(await canvasToBlob(this.renderToCanvas(false), 'image/jpeg', .92), this.originalFile?.name || 'photo'); }
    async reset() { this.baseDataURL = await blobToDataURL(this.originalFile); this.image = await dataURLToImage(this.baseDataURL); this.resetState(); this.history.clear(); this.history.push(this.snapshot()); this.render(); this.changed(); }
}
