import { EditorHistory } from './editorHistory.js';
import { clamp } from './editorUtils.js';

const STANDARD_WIDTH = 1150;
const STANDARD_HEIGHT = 628;
const MAX_EXPORT_SIZE = 100 * 1024 * 1024;

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '00:00';
    const total = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export class VideoEditor {
    constructor(elements, options = {}) {
        this.el = elements;
        this.options = options;
        this.history = new EditorHistory(30);

        this.video = document.createElement('video');
        this.video.preload = 'auto';
        this.video.playsInline = true;
        this.video.controls = false;
        this.video.crossOrigin = 'anonymous';
        this.video.muted = true;
        this.video.style.display = 'none';

        this.objectURL = null;
        this.originalFile = null;
        this.renderHandle = null;
        this.outputTempCanvas = document.createElement('canvas');
        this.outputTempCanvas.width = STANDARD_WIDTH;
        this.outputTempCanvas.height = STANDARD_HEIGHT;
        this.playing = false;
        this.audioContext = null;
        this.mediaSourceNode = null;
        this.audioGainNode = null;
        this.audioDestination = null;

        this.rotation = 0;
        this.flipX = false;
        this.flipY = false;
        this.filters = { brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0, blur: 0 };
        this.text = [];
        this.elements = [];
        this.crop = null;
        this.trimStart = 0;
        this.trimEnd = Number.isFinite(this.video.duration) ? this.video.duration : 0;
        this.cropActive = false;
        this.dragging = false;
        this.cropStart = null;
        this.selectedOverlay = null;
        this.overlayDrag = null;
        this.active = false;
        this.loadId = 0;

        this.initCanvasEvents();

        this.video.addEventListener('timeupdate', () => {
            if (!this.active) return;
            if (this.playing && this.trimEnd > 0 && this.video.currentTime >= this.trimEnd) {
                this.video.currentTime = this.trimEnd;
                this.pause();
            }
            this.updateTimelineUI();
            this.render();
        });
        this.video.addEventListener('durationchange', () => {
            if (!this.trimEnd || this.trimEnd > this.video.duration) this.trimEnd = Number.isFinite(this.video.duration) ? this.video.duration : 0;
            this.updateTimelineUI();
            this.updateTrimUI();
        });
        this.video.addEventListener('ended', () => {
            if (!this.active) return;
            this.playing = false;
            if (this.el.playButton) this.el.playButton.textContent = '▶ Lire';
            this.updateTimelineUI();
            this.render();
        });
    }

    setActive(active) {
        this.active = Boolean(active);
        if (!this.active) {
            this.stopPlayback();
            this.cropActive = false;
            this.dragging = false;
            this.overlayDrag = null;
            this.el.canvas.classList.remove('editor-cropping');
            if (this.el.cropOverlay) this.el.cropOverlay.hidden = true;
        }
    }

    async load(file) {
        const loadId = ++this.loadId;
        this.stopPlayback();
        this.originalFile = file;
        if (this.objectURL) URL.revokeObjectURL(this.objectURL);
        this.objectURL = URL.createObjectURL(file);
        this.video.src = this.objectURL;
        this.video.load();
        await new Promise((resolve, reject) => {
            const onLoaded = () => cleanup(resolve);
            const onError = () => cleanup(() => reject(new Error('Impossible de charger la vidéo dans l’éditeur.')));
            const cleanup = (fn) => {
                this.video.removeEventListener('loadedmetadata', onLoaded);
                this.video.removeEventListener('error', onError);
                fn();
            };
            this.video.addEventListener('loadedmetadata', onLoaded, { once: true });
            this.video.addEventListener('error', onError, { once: true });
        });

        if (loadId !== this.loadId || this.originalFile !== file) return;
        this.resetState();
        this.video.currentTime = 0;
        this.history.clear();
        this.history.push(this.snapshot());
        this.startRenderLoop();
        this.updateTimelineUI();
        this.render();
    }

    resetState() {
        this.rotation = 0;
        this.flipX = false;
        this.flipY = false;
        this.filters = { brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0, blur: 0 };
        this.text = [];
        this.elements = [];
        this.crop = null;
        this.trimStart = 0;
        this.trimEnd = Number.isFinite(this.video.duration) ? this.video.duration : 0;
        this.cropActive = false;
        this.selectedOverlay = null;
        this.overlayDrag = null;
        this.dragging = false;
        this.cropStart = null;
        this.updateSelectedOverlayUI();
    }

    snapshot() {
        return {
            rotation: this.rotation,
            flipX: this.flipX,
            flipY: this.flipY,
            filters: { ...this.filters },
            text: structuredClone(this.text),
            elements: structuredClone(this.elements),
            crop: this.crop ? { ...this.crop } : null,
            trimStart: this.trimStart,
            trimEnd: this.trimEnd
        };
    }

    async restore(state) {
        this.rotation = state.rotation;
        this.flipX = state.flipX;
        this.flipY = state.flipY;
        this.filters = { ...state.filters };
        this.text = structuredClone(state.text);
        this.elements = structuredClone(state.elements);
        this.crop = state.crop ? { ...state.crop } : null;
        const duration = Number.isFinite(this.video.duration) ? this.video.duration : 0;
        this.trimStart = clamp(Number(state.trimStart) || 0, 0, duration);
        this.trimEnd = clamp(Number(state.trimEnd) || duration, this.trimStart + Math.min(0.1, Math.max(duration - this.trimStart, 0)), duration);
        if (duration <= 0.1) this.trimEnd = duration;
        this.cropActive = false;
        this.selectedOverlay = null;
        this.overlayDrag = null;
        this.render();
        this.updateSelectedOverlayUI();
    }

    commit() {
        this.history.push(this.snapshot());
        this.render();
        this.updateSelectedOverlayUI();
        this.changed();
    }

    changed() {
        this.options.onChange?.(this.canUndo(), this.canRedo());
    }

    async undo() {
        const state = this.history.undo();
        if (state) await this.restore(state);
        this.changed();
    }

    async redo() {
        const state = this.history.redo();
        if (state) await this.restore(state);
        this.changed();
    }

    canUndo() { return this.history.canUndo(); }
    canRedo() { return this.history.canRedo(); }

    getOutputSize() {
        return { width: STANDARD_WIDTH, height: STANDARD_HEIGHT };
    }

    getFilterString() {
        const f = this.filters;
        return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) grayscale(${f.grayscale}%) sepia(${f.sepia}%) blur(${f.blur}px)`;
    }

    drawBaseFrame(ctx) {
        const size = this.getOutputSize();
        const videoWidth = this.video.videoWidth || 1;
        const videoHeight = this.video.videoHeight || 1;
        const angle = ((this.rotation % 360) + 360) % 360;
        const quarterTurn = angle === 90 || angle === 270;
        const rotatedWidth = quarterTurn ? videoHeight : videoWidth;
        const rotatedHeight = quarterTurn ? videoWidth : videoHeight;
        const fit = Math.min(size.width / rotatedWidth, size.height / rotatedHeight);
        const drawWidth = videoWidth * fit;
        const drawHeight = videoHeight * fit;

        ctx.save();
        ctx.translate(size.width / 2, size.height / 2);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.scale(this.flipX ? -1 : 1, this.flipY ? -1 : 1);
        ctx.filter = this.getFilterString();
        ctx.drawImage(this.video, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
        ctx.filter = 'none';

        if (this.crop && this.crop.width > 0 && this.crop.height > 0) {
            const temp = this.outputTempCanvas;
            const tempCtx = temp.getContext('2d');
            tempCtx.clearRect(0, 0, size.width, size.height);
            tempCtx.drawImage(ctx.canvas, 0, 0);
            ctx.clearRect(0, 0, size.width, size.height);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, size.width, size.height);
            ctx.drawImage(
                temp,
                this.crop.x,
                this.crop.y,
                this.crop.width,
                this.crop.height,
                0,
                0,
                size.width,
                size.height
            );
        }
    }

    render() {
        const canvas = this.el.canvas;
        const ctx = canvas.getContext('2d');
        const size = this.getOutputSize();
        canvas.width = size.width;
        canvas.height = size.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (this.video.readyState >= 2) {
            this.drawBaseFrame(ctx);
        }

        this.drawOverlays(ctx);
        this.updateCropOverlay();
        if (this.el.dimensions) {
            this.el.dimensions.textContent = `${canvas.width} × ${canvas.height}px — format standard vidéo`;
        }
        this.updateTimelineUI();
    }

    drawOverlays(ctx) {
        for (const item of this.text) {
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(item.rotation || 0);
            ctx.font = `${item.weight} ${item.size}px ${item.font}`;
            ctx.fillStyle = item.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (item.stroke) {
                ctx.lineWidth = Math.max(2, item.size / 10);
                ctx.strokeStyle = item.stroke;
                ctx.strokeText(item.value, 0, 0);
            }
            ctx.fillText(item.value, 0, 0);
            ctx.restore();
        }

        for (const item of this.elements) {
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(item.rotation || 0);
            ctx.fillStyle = item.fill;
            ctx.strokeStyle = item.stroke || item.fill;
            ctx.lineWidth = item.lineWidth || 4;
            if (item.type === 'circle') {
                ctx.beginPath(); ctx.arc(0, 0, item.size / 2, 0, Math.PI * 2); ctx.fill();
            } else if (item.type === 'rectangle') {
                ctx.fillRect(-item.size / 2, -item.size / 2, item.size, item.size);
            } else if (item.type === 'star') {
                this.drawStar(ctx, item.size / 2, 5);
            } else if (item.type === 'heart') {
                this.drawHeart(ctx, item.size);
            } else if (item.type === 'emoji') {
                ctx.font = `${item.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.value, 0, 0);
            }
            ctx.restore();
        }

        this.drawSelection(ctx);
    }

    drawStar(ctx, radius, points) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const angle = -Math.PI / 2 + i * Math.PI / points;
            const r = i % 2 === 0 ? radius : radius * 0.45;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
    }

    drawHeart(ctx, size) {
        const s = size / 2;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.9);
        ctx.bezierCurveTo(-s * 1.15, s * 0.15, -s * 0.85, -s * 0.85, 0, -s * 0.35);
        ctx.bezierCurveTo(s * 0.85, -s * 0.85, s * 1.15, s * 0.15, 0, s * 0.9);
        ctx.closePath();
        ctx.fill();
    }

    drawSelection(ctx) {
        const selected = this.getSelectedItem();
        if (!selected) return;
        const box = this.getOverlayBounds(selected.kind, selected.item);
        ctx.save();
        ctx.translate(selected.item.x, selected.item.y);
        ctx.rotate(selected.item.rotation || 0);
        ctx.strokeStyle = '#fff';
        ctx.fillStyle = 'rgba(255,255,255,.08)';
        ctx.lineWidth = Math.max(2, 3);
        ctx.setLineDash([8, 5]);
        ctx.strokeRect(box.x - selected.item.x, box.y - selected.item.y, box.width, box.height);
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
        if (this.el.selectedOverlayLabel) {
            this.el.selectedOverlayLabel.textContent = isText ? 'Texte sélectionné' : 'Élément sélectionné';
        }
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
    }

    moveSelectedTo(point) {
        const selected = this.getSelectedItem();
        if (!selected) return;
        const box = this.getOverlayBounds(selected.kind, selected.item);
        const halfW = box.width / 2;
        const halfH = box.height / 2;
        selected.item.x = clamp(point.x, halfW, this.el.canvas.width - halfW);
        selected.item.y = clamp(point.y, halfH, this.el.canvas.height - halfH);
    }

    rotate(degrees) {
        this.rotation = (this.rotation + degrees + 360) % 360;
        const all = [...this.text, ...this.elements];
        if (degrees === 90 || degrees === -270) {
            for (const item of all) {
                const oldX = item.x;
                item.x = STANDARD_WIDTH - item.y;
                item.y = oldX;
            }
        } else if (degrees === -90 || degrees === 270) {
            for (const item of all) {
                const oldX = item.x;
                item.x = item.y;
                item.y = STANDARD_HEIGHT - oldX;
            }
        }
        for (const item of all) item.x = clamp(item.x, 0, STANDARD_WIDTH);
        for (const item of all) item.y = clamp(item.y, 0, STANDARD_HEIGHT);
        this.commit();
    }

    flip(axis) {
        const all = [...this.text, ...this.elements];
        if (axis === 'x') {
            this.flipX = !this.flipX;
            for (const item of all) item.x = STANDARD_WIDTH - item.x;
        } else {
            this.flipY = !this.flipY;
            for (const item of all) item.y = STANDARD_HEIGHT - item.y;
        }
        this.commit();
    }

    applyFilter(name, value) {
        if (!(name in this.filters)) return;
        this.filters[name] = Number(value);
        this.render();
    }

    commitFilters() {
        this.commit();
        this.changed();
    }

    addText(value, options = {}) {
        value = String(value || '').trim();
        if (!value) throw new Error('Le texte ne peut pas être vide.');
        const item = {
            value,
            x: STANDARD_WIDTH / 2,
            y: STANDARD_HEIGHT / 2,
            size: Number(options.size) || Math.max(24, Math.round(STANDARD_WIDTH / 20)),
            color: options.color || '#ffffff',
            stroke: options.stroke || '#000000',
            weight: 'bold',
            font: 'Arial',
            rotation: 0
        };
        this.text.push(item);
        this.selectedOverlay = { kind: 'text', index: this.text.length - 1 };
        this.commit();
    }

    addElement(type, options = {}) {
        const allowed = ['circle', 'rectangle', 'star', 'heart', 'emoji'];
        if (!allowed.includes(type)) throw new Error('Élément inconnu.');
        const item = {
            type,
            value: options.value || '✨',
            x: STANDARD_WIDTH / 2,
            y: STANDARD_HEIGHT / 2,
            size: Number(options.size) || Math.max(48, Math.round(STANDARD_WIDTH / 10)),
            fill: options.fill || '#d83ca9',
            stroke: '#ffffff',
            lineWidth: 4,
            rotation: 0
        };
        this.elements.push(item);
        this.selectedOverlay = { kind: 'element', index: this.elements.length - 1 };
        this.commit();
    }

    getTrimDuration() {
        return Math.max(0, this.trimEnd - this.trimStart);
    }

    setTrimStart(value, commit = true) {
        const duration = Number.isFinite(this.video.duration) ? this.video.duration : 0;
        if (!duration) return;
        const next = clamp(Number(value) || 0, 0, Math.max(0, this.trimEnd - 0.1));
        this.trimStart = Math.min(next, this.trimEnd - Math.min(0.1, duration));
        if (this.trimStart < 0) this.trimStart = 0;
        if (this.video.currentTime < this.trimStart || this.video.currentTime > this.trimEnd) this.video.currentTime = this.trimStart;
        this.updateTimelineUI();
        this.updateTrimUI();
        this.render();
        if (commit) this.commit();
    }

    setTrimEnd(value, commit = true) {
        const duration = Number.isFinite(this.video.duration) ? this.video.duration : 0;
        if (!duration) return;
        const minimum = this.trimStart + Math.min(0.1, duration);
        const next = clamp(Number(value) || duration, minimum, duration);
        this.trimEnd = next;
        if (this.video.currentTime < this.trimStart || this.video.currentTime > this.trimEnd) this.video.currentTime = this.trimStart;
        this.updateTimelineUI();
        this.updateTrimUI();
        this.render();
        if (commit) this.commit();
    }

    updateTrimUI() {
        const duration = Number.isFinite(this.video.duration) ? this.video.duration : 0;
        if (this.el.trimStartInput) {
            this.el.trimStartInput.max = String(duration);
            this.el.trimStartInput.value = String(Math.min(this.trimStart, duration));
        }
        if (this.el.trimEndInput) {
            this.el.trimEndInput.max = String(duration);
            this.el.trimEndInput.value = String(Math.min(this.trimEnd || duration, duration));
        }
        if (this.el.trimStartValue) this.el.trimStartValue.textContent = formatTime(this.trimStart);
        if (this.el.trimEndValue) this.el.trimEndValue.textContent = formatTime(this.trimEnd || duration);
        if (this.el.trimDurationValue) this.el.trimDurationValue.textContent = formatTime(this.getTrimDuration());
    }

    startCrop() {
        this.cropActive = true;
        this.el.canvas.classList.add('editor-cropping');
        if (this.el.cropHint) this.el.cropHint.textContent = 'Tracez une zone sur la vidéo puis cliquez sur Valider.';
    }

    cancelCrop() {
        this.cropActive = false;
        this.cropStart = null;
        this.dragging = false;
        this.el.canvas.classList.remove('editor-cropping');
        if (this.el.cropOverlay) this.el.cropOverlay.hidden = true;
        this.render();
    }

    pointerToCanvas(e) {
        const rect = this.el.canvas.getBoundingClientRect();
        return {
            x: clamp((e.clientX - rect.left) * this.el.canvas.width / rect.width, 0, this.el.canvas.width),
            y: clamp((e.clientY - rect.top) * this.el.canvas.height / rect.height, 0, this.el.canvas.height)
        };
    }

    updateCropOverlay() {
        if (!this.cropActive || !this.currentSelectionCrop) {
            if (this.el.cropOverlay) this.el.cropOverlay.hidden = true;
            return;
        }
        const r = this.el.canvas.getBoundingClientRect();
        const p = this.el.canvas.parentElement.getBoundingClientRect();
        const sx = r.width / this.el.canvas.width;
        const sy = r.height / this.el.canvas.height;
        const crop = this.currentSelectionCrop;
        Object.assign(this.el.cropOverlay.style, {
            left: `${r.left - p.left + crop.x * sx}px`,
            top: `${r.top - p.top + crop.y * sy}px`,
            width: `${crop.width * sx}px`,
            height: `${crop.height * sy}px`
        });
        this.el.cropOverlay.hidden = false;
    }

    initCanvasEvents() {
        const canvas = this.el.canvas;
        canvas.addEventListener('pointerdown', (e) => {
            if (!this.active) return;
            e.preventDefault();
            const point = this.pointerToCanvas(e);
            if (this.cropActive) {
                this.cropStart = point;
                this.currentSelectionCrop = { x: point.x, y: point.y, width: 0, height: 0 };
                this.dragging = true;
                canvas.setPointerCapture?.(e.pointerId);
                return;
            }
            const hit = this.hitTestOverlay(point);
            this.selectOverlay(hit);
            if (hit) {
                this.overlayDrag = {
                    pointerId: e.pointerId,
                    offsetX: point.x - hit.item.x,
                    offsetY: point.y - hit.item.y
                };
                this.dragging = true;
                canvas.setPointerCapture?.(e.pointerId);
            }
        });

        canvas.addEventListener('pointermove', (e) => {
            if (!this.active) return;
            const point = this.pointerToCanvas(e);
            if (this.cropActive && this.dragging) {
                const start = this.cropStart;
                this.currentSelectionCrop = {
                    x: Math.min(start.x, point.x),
                    y: Math.min(start.y, point.y),
                    width: Math.abs(point.x - start.x),
                    height: Math.abs(point.y - start.y)
                };
                this.updateCropOverlay();
                return;
            }
            if (!this.overlayDrag || !this.dragging || this.overlayDrag.pointerId !== e.pointerId) return;
            this.moveSelectedTo({
                x: point.x - this.overlayDrag.offsetX,
                y: point.y - this.overlayDrag.offsetY
            });
            this.render();
        });

        const end = (e) => {
            if (!this.active) return;
            if (this.cropActive) {
                if (!this.dragging) return;
                this.dragging = false;
                canvas.releasePointerCapture?.(e.pointerId);
                return;
            }
            if (!this.overlayDrag || !this.dragging || this.overlayDrag.pointerId !== e.pointerId) return;
            this.dragging = false;
            this.overlayDrag = null;
            canvas.releasePointerCapture?.(e.pointerId);
            this.commit();
        };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
        canvas.addEventListener('dblclick', (e) => {
            if (!this.active || this.cropActive) return;
            this.selectOverlay(this.hitTestOverlay(this.pointerToCanvas(e)));
        });
    }

    applyCrop() {
        const selection = this.currentSelectionCrop;
        if (!selection || selection.width < 10 || selection.height < 10) {
            throw new Error('Sélection de recadrage trop petite.');
        }

        if (!this.crop) {
            this.crop = { ...selection };
        } else {
            const old = this.crop;
            this.crop = {
                x: old.x + (selection.x / STANDARD_WIDTH) * old.width,
                y: old.y + (selection.y / STANDARD_HEIGHT) * old.height,
                width: (selection.width / STANDARD_WIDTH) * old.width,
                height: (selection.height / STANDARD_HEIGHT) * old.height
            };
        }

        this.currentSelectionCrop = null;
        this.cropActive = false;
        this.dragging = false;
        this.el.canvas.classList.remove('editor-cropping');
        if (this.el.cropOverlay) this.el.cropOverlay.hidden = true;
        this.commit();
    }

    renderForExport() {
        const canvas = document.createElement('canvas');
        canvas.width = STANDARD_WIDTH;
        canvas.height = STANDARD_HEIGHT;
        const ctx = canvas.getContext('2d');
        const previousSelection = this.selectedOverlay;
        this.selectedOverlay = null;
        this.drawBaseFrame(ctx);
        this.drawOverlays(ctx);
        this.selectedOverlay = previousSelection;
        return canvas;
    }

    async seekTo(time) {
        const duration = Number.isFinite(this.video.duration) ? this.video.duration : 0;
        const target = clamp(Number(time) || 0, 0, duration);
        if (Math.abs(this.video.currentTime - target) < 0.02) {
            this.video.currentTime = target;
            return;
        }
        await new Promise((resolve) => {
            const handler = () => {
                this.video.removeEventListener('seeked', handler);
                resolve();
            };
            this.video.addEventListener('seeked', handler, { once: true });
            this.video.currentTime = target;
            setTimeout(handler, 1000);
        });
    }

    async exportFile() {
        if (!this.video.duration || !Number.isFinite(this.video.duration)) {
            throw new Error('La durée de la vidéo est invalide.');
        }
        if (!window.MediaRecorder) {
            throw new Error('Votre navigateur ne permet pas l’export vidéo depuis cet éditeur.');
        }

        this.stopPlayback();
        if (this.trimEnd <= this.trimStart) throw new Error('La plage de la vidéo est invalide.');
        await this.seekTo(this.trimStart);

        const canvas = document.createElement('canvas');
        canvas.width = STANDARD_WIDTH;
        canvas.height = STANDARD_HEIGHT;
        const ctx = canvas.getContext('2d');

        const renderExportFrame = () => {
            ctx.clearRect(0, 0, STANDARD_WIDTH, STANDARD_HEIGHT);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, STANDARD_WIDTH, STANDARD_HEIGHT);
            this.drawBaseFrame(ctx);
            const previous = this.selectedOverlay;
            this.selectedOverlay = null;
            this.drawOverlays(ctx);
            this.selectedOverlay = previous;
        };

        const canvasStream = canvas.captureStream(30);
        let sourceStream = null;
        let audioTracks = [];
        let usingWebAudio = false;

        // Le média source est routé vers une destination audio dédiée avec le volume
        // de sortie à 0 : le son est conservé dans le fichier exporté sans être joué
        // dans les haut-parleurs pendant toute la durée de l'export.
        try {
            if (!this.audioContext) {
                this.audioContext = new AudioContext();
                this.mediaSourceNode = this.audioContext.createMediaElementSource(this.video);
                this.audioGainNode = this.audioContext.createGain();
                this.audioGainNode.gain.value = 0;
                this.audioDestination = this.audioContext.createMediaStreamDestination();
                this.mediaSourceNode.connect(this.audioGainNode);
                this.mediaSourceNode.connect(this.audioDestination);
                this.audioGainNode.connect(this.audioContext.destination);
            }
            await this.audioContext.resume();
            this.video.muted = false;
            this.video.volume = 1;
            audioTracks = this.audioDestination.stream.getAudioTracks();
            usingWebAudio = audioTracks.length > 0;
        } catch (_) {
            usingWebAudio = false;
        }

        if (!usingWebAudio && typeof this.video.captureStream === 'function') {
            try {
                sourceStream = this.video.captureStream();
                audioTracks = sourceStream.getAudioTracks();
            } catch (_) {
                audioTracks = [];
            }
        }

        audioTracks.forEach(track => canvasStream.addTrack(track));

        const mimeTypes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
        ];
        const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
        if (!mimeType) {
            canvasStream.getTracks().forEach(track => track.stop());
            sourceStream?.getTracks().forEach(track => track.stop());
            throw new Error('Aucun format vidéo compatible WebM n’est disponible dans ce navigateur.');
        }

        const chunks = [];
        const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 6_000_000 });
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

        let raf = null;
        const drawLoop = () => {
            renderExportFrame();
            if (!this.video.paused && !this.video.ended) raf = requestAnimationFrame(drawLoop);
        };

        const stopped = new Promise((resolve, reject) => {
            recorder.onerror = () => reject(new Error('Erreur pendant l’export de la vidéo.'));
            recorder.onstop = () => resolve();
        });

        try {
            recorder.start(250);
            this.video.muted = true;
            await this.video.play();
            drawLoop();
            await new Promise(resolve => {
                const checkTrimEnd = () => {
                    if (this.video.currentTime >= this.trimEnd || this.video.ended) {
                        resolve();
                        return;
                    }
                    requestAnimationFrame(checkTrimEnd);
                };
                checkTrimEnd();
            });
            this.video.pause();
            this.video.currentTime = this.trimEnd;
            await new Promise(resolve => setTimeout(resolve, 30));
            if (raf) cancelAnimationFrame(raf);
            renderExportFrame();
            recorder.stop();
            await stopped;
        } catch (error) {
            if (raf) cancelAnimationFrame(raf);
            if (recorder.state !== 'inactive') recorder.stop();
            throw error;
        } finally {
            canvasStream.getVideoTracks().forEach(track => track.stop());
            if (!usingWebAudio) canvasStream.getAudioTracks().forEach(track => track.stop());
            sourceStream?.getTracks().forEach(track => track.stop());
            this.video.pause();
            this.video.muted = true;
            this.playing = false;
        }

        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size > MAX_EXPORT_SIZE) {
            throw new Error('La vidéo éditée dépasse la limite de 100 Mo. Réduisez sa durée ou utilisez une vidéo plus légère.');
        }
        const base = (this.originalFile?.name || 'video').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'video';
        return new File([blob], `${base}-editee.webm`, { type: 'video/webm', lastModified: Date.now() });
    }

    async reset() {
        if (!this.originalFile) return;
        await this.load(this.originalFile);
        this.changed();
    }

    async play() {
        if (!Number.isFinite(this.video.duration) || this.video.duration <= 0) throw new Error('La durée de la vidéo est invalide.');
        if (this.video.currentTime < this.trimStart || this.video.currentTime >= this.trimEnd - 0.01) {
            this.video.currentTime = this.trimStart;
            await new Promise(resolve => {
                const handler = () => { this.video.removeEventListener('seeked', handler); resolve(); };
                this.video.addEventListener('seeked', handler, { once: true });
                setTimeout(handler, 500);
            });
        }
        await this.video.play();
        this.playing = true;
        if (this.el.playButton) this.el.playButton.textContent = '⏸ Pause';
        this.startRenderLoop();
    }

    pause() {
        this.video.pause();
        this.playing = false;
        if (this.el.playButton) this.el.playButton.textContent = '▶ Lire';
        this.render();
    }

    togglePlayback() {
        if (this.video.paused) return this.play();
        this.pause();
    }

    stopPlayback() {
        this.pause();
        if (this.video.readyState >= 1) this.video.currentTime = 0;
        this.render();
    }

    startRenderLoop() {
        if (this.renderHandle) cancelAnimationFrame(this.renderHandle);
        const loop = () => {
            this.render();
            if (!this.video.paused && !this.video.ended) this.renderHandle = requestAnimationFrame(loop);
            else this.renderHandle = null;
        };
        this.renderHandle = requestAnimationFrame(loop);
    }

    seek(value) {
        if (!Number.isFinite(this.video.duration)) return;
        this.video.currentTime = clamp(Number(value), 0, this.video.duration);
        this.render();
    }

    updateTimelineUI() {
        if (this.el.timeline) {
            this.el.timeline.max = String(Number.isFinite(this.video.duration) ? this.video.duration : 0);
            this.el.timeline.value = String(this.video.currentTime || 0);
        }
        if (this.el.timeLabel) {
            this.el.timeLabel.textContent = `${formatTime(this.video.currentTime || 0)} / ${formatTime(this.video.duration || 0)}`;
        }
        this.updateTrimUI();
    }

    destroy() {
        this.stopPlayback();
        if (this.renderHandle) cancelAnimationFrame(this.renderHandle);
        if (this.objectURL) URL.revokeObjectURL(this.objectURL);
        this.objectURL = null;
        this.video.removeAttribute('src');
        this.video.load();
    }
}
