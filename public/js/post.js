import { ImageEditor } from './editor/imageEditor.js';
import { VideoEditor } from './editor/videoEditor.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('upload-form');
    const mediaInput = document.getElementById('media');
    const previewContainer = document.getElementById('preview-container');
    const imagePreview = document.getElementById('image-preview');
    const videoPreview = document.getElementById('video-preview');
    const message = document.getElementById('message');
    const editorModal = document.getElementById('editor-modal');
    const editorCanvas = document.getElementById('editor-canvas');
    const cropOverlay = document.getElementById('editor-crop-overlay');
    const cropHint = document.getElementById('crop-hint');
    const cropAspectInput = document.getElementById('crop-aspect');
    const dimensions = document.getElementById('editor-dimensions');
    const editorMessage = document.getElementById('editor-message');
    const editorFileName = document.getElementById('editor-file-name');
    const editorTitle = document.getElementById('editor-title');
    const openEditorButton = document.getElementById('open-editor');
    const closeEditorButton = document.getElementById('close-editor');
    const cancelEditorButton = document.getElementById('cancel-editor');
    const applyEditorButton = document.getElementById('apply-editor');
    const undoButton = document.getElementById('editor-undo');
    const redoButton = document.getElementById('editor-redo');
    const resetButton = document.getElementById('editor-reset');
    const cropStartButton = document.getElementById('crop-start');
    const cropApplyButton = document.getElementById('crop-apply');
    const cropCancelButton = document.getElementById('crop-cancel');
    const addTextButton = document.getElementById('add-text');
    const addElementButton = document.getElementById('add-element');
    const elementColorInput = document.getElementById('element-color');
    const selectedOverlayPanel = document.getElementById('selected-overlay-panel');
    const selectedOverlayLabel = document.getElementById('selected-overlay-label');
    const selectedTextSizeInput = document.getElementById('selected-text-size');
    const selectedTextSizeValue = document.getElementById('selected-text-size-value');
    const overlayColorInput = document.getElementById('overlay-color');
    const textSizeInput = document.getElementById('text-size');
    const textSizeValue = document.getElementById('text-size-value');
    const textFontInput = document.getElementById('text-font');
    const textWeightInput = document.getElementById('text-weight');
    const textStyleInput = document.getElementById('text-style');
    const textOpacityInput = document.getElementById('text-opacity');
    const textOpacityValue = document.getElementById('text-opacity-value');
    const elementSizeInput = document.getElementById('element-size');
    const elementSizeValue = document.getElementById('element-size-value');
    const elementOpacityInput = document.getElementById('element-opacity');
    const elementOpacityValue = document.getElementById('element-opacity-value');
    const textEmojiToggle = document.getElementById('text-emoji-toggle');
    const filterApplyButton = document.getElementById('filters-apply');
    const playButton = document.getElementById('editor-play');
    const timeline = document.getElementById('editor-timeline');
    const timeLabel = document.getElementById('editor-time');
    const videoControls = document.getElementById('editor-video-controls');
    const videoTrimGroup = document.getElementById('video-trim-group');
    const trimStartInput = document.getElementById('editor-trim-start');
    const trimEndInput = document.getElementById('editor-trim-end');
    const trimStartValue = document.getElementById('editor-trim-start-value');
    const trimEndValue = document.getElementById('editor-trim-end-value');
    const trimDurationValue = document.getElementById('editor-trim-duration-value');
    const textInput = document.getElementById('text-value');
    const textEmojiPicker = document.getElementById('text-emoji-picker');
    const selectedOverlayOpacityInput = document.getElementById('selected-overlay-opacity');
    const selectedOverlayOpacityValue = document.getElementById('selected-overlay-opacity-value');
    const selectedTextFormatRow = document.getElementById('selected-text-format-row');
    const selectedTextFont = document.getElementById('selected-text-font');
    const selectedTextWeight = document.getElementById('selected-text-weight');
    const selectedTextStyle = document.getElementById('selected-text-style');
    const layerUpButton = document.getElementById('layer-up');
    const layerDownButton = document.getElementById('layer-down');
    const layerDeleteButton = document.getElementById('layer-delete');
    const videoAudioGroup = document.getElementById('video-audio-group');
    const videoSpeedGroup = document.getElementById('video-speed-group');
    const muteButton = document.getElementById('editor-mute');
    const volumeInput = document.getElementById('editor-volume');
    const volumeValue = document.getElementById('editor-volume-value');
    const speedInput = document.getElementById('editor-speed');

    if (!form || !mediaInput) return;

    const IMAGE_MAX_SIZE = 20 * 1024 * 1024;
    const VIDEO_MAX_SIZE = 100 * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    let previewUrl = null;
    let selectedFile = null;
    let editedFile = null;
    let activeEditor = null;
    let activeEditorType = null;
    let mediaSelectionVersion = 0;

    const imageEditor = new ImageEditor({ canvas: editorCanvas, cropOverlay, cropHint, cropAspectInput, dimensions, selectedOverlayPanel, selectedOverlayLabel, selectedTextSizeInput, selectedTextSizeValue, selectedOverlayOpacityInput, selectedOverlayOpacityValue, selectedTextFormatRow, selectedTextFont, selectedTextWeight, selectedTextStyle, overlayColor: overlayColorInput }, {
        onChange: (canUndo, canRedo) => {
            undoButton.disabled = !canUndo;
            redoButton.disabled = !canRedo;
        }
    });

    const videoEditor = new VideoEditor({
        canvas: editorCanvas,
        cropOverlay,
        cropHint,
        cropAspectInput,
        dimensions,
        selectedOverlayPanel,
        selectedOverlayLabel,
        selectedTextSizeInput,
        selectedTextSizeValue,
        selectedOverlayOpacityInput,
        selectedOverlayOpacityValue,
        selectedTextFormatRow,
        selectedTextFont,
        selectedTextWeight,
        selectedTextStyle,
        overlayColor: overlayColorInput,
        playButton,
        timeline,
        timeLabel,
        volumeInput,
        volumeValue,
        muteButton,
        speedInput,
        trimStartInput,
        trimEndInput,
        trimStartValue,
        trimEndValue,
        trimDurationValue
    }, {
        onChange: (canUndo, canRedo) => {
            undoButton.disabled = !canUndo;
            redoButton.disabled = !canRedo;
        }
    });

    function setMessage(text, error = false) {
        message.textContent = text;
        message.classList.toggle('error', error);
    }

    function setEditorMessage(text, error = false) {
        editorMessage.textContent = text;
        editorMessage.classList.toggle('error', error);
    }

    function clearPreview() {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        imagePreview.src = '';
        videoPreview.removeAttribute('src');
        videoPreview.load();
        imagePreview.style.display = 'none';
        videoPreview.style.display = 'none';
        previewContainer.style.display = 'none';
    }

    function mediaType(file) {
        if (ALLOWED_IMAGE_TYPES.includes(file.type)) return 'image';
        if (ALLOWED_VIDEO_TYPES.includes(file.type)) return 'video';
        return null;
    }

    function validateFile(file) {
        const type = mediaType(file);
        if (!type) return { valid: false, error: 'Veuillez sélectionner une image ou une vidéo dans un format autorisé.' };
        const max = type === 'image' ? IMAGE_MAX_SIZE : VIDEO_MAX_SIZE;
        if (file.size > max) return { valid: false, error: type === 'image' ? 'L’image ne doit pas dépasser 20 Mo.' : 'La vidéo ne doit pas dépasser 100 Mo.' };
        return { valid: true, type };
    }

    function refreshPreview(file) {
        clearPreview();
        previewUrl = URL.createObjectURL(file);
        previewContainer.style.display = 'block';
        if (mediaType(file) === 'image') {
            imagePreview.src = previewUrl;
            imagePreview.style.display = 'block';
        } else {
            videoPreview.src = previewUrl;
            videoPreview.style.display = 'block';
            videoPreview.load();
        }
    }

    function setVideoOnlyControlsVisible(visible) {
        const controls = [videoControls, videoTrimGroup, videoAudioGroup, videoSpeedGroup];
        controls.forEach((element) => {
            if (!element) return;
            element.hidden = !visible;
            element.setAttribute('aria-hidden', String(!visible));
        });
    }

    function updateEditorMode(type) {
        const isVideo = type === 'video';
        editorTitle.textContent = isVideo ? 'Éditeur vidéo' : 'Éditeur photo';
        openEditorButton.textContent = isVideo ? '✨ Modifier la vidéo' : '✨ Modifier la photo';
        applyEditorButton.textContent = isVideo ? '✓ Utiliser cette vidéo' : '✓ Utiliser cette photo';

        // Les outils spécifiques à la vidéo ne doivent jamais apparaître
        // lorsque l'éditeur photo est actif, même si l'utilisateur vient
        // juste d'éditer une vidéo.
        setVideoOnlyControlsVisible(isVideo);

        if (cropAspectInput) cropAspectInput.value = 'free';
        activeEditor?.setCropAspect?.('free');

        if (isVideo) {
            videoEditor.updateAudioUI();
        } else {
            videoEditor.pause();
            if (playButton) playButton.textContent = '▶ Lire';
            if (timeline) timeline.value = '0';
            if (timeLabel) timeLabel.textContent = '00:00 / 00:00';
        }

        if (!isVideo) {
            // Remise à zéro visuelle des contrôles vidéo pour éviter qu'une
            // ancienne session vidéo laisse un état visible ou interactif.
            if (volumeInput) volumeInput.value = '100';
            if (volumeValue) volumeValue.textContent = '100';
            if (speedInput) speedInput.value = '1';
            if (trimStartInput) trimStartInput.value = '0';
            if (trimEndInput) trimEndInput.value = '0';
            if (trimStartValue) trimStartValue.textContent = '00:00';
            if (trimEndValue) trimEndValue.textContent = '00:00';
            if (trimDurationValue) trimDurationValue.textContent = '00:00';
        }
    }

    function showEditor() {
        if (!selectedFile) return;
        activeEditorType = mediaType(selectedFile);
        imageEditor.setActive(false);
        videoEditor.setActive(false);
        activeEditor = activeEditorType === 'video' ? videoEditor : imageEditor;
        if (!activeEditor) return;
        activeEditor.setActive(true);
        editorFileName.textContent = selectedFile.name;
        updateEditorMode(activeEditorType);
        editorModal.hidden = false;
        document.body.classList.add('editor-open');
        setEditorMessage(activeEditorType === 'video'
            ? 'La vidéo est prévisualisée dans le cadre standard 1150 × 628. Vous pouvez ajouter des retouches puis exporter la vidéo.'
            : 'La photo est éditée dans le cadre standard 1150 × 628.');
        activeEditor.render();
    }

    function hideEditor() {
        imageEditor.setActive(false);
        videoEditor.setActive(false);
        editorModal.hidden = true;
        activeEditor?.cancelCrop();
        document.body.classList.remove('editor-open');
        setEditorMessage('');
        activeEditor = null;
        activeEditorType = null;
    }

    mediaInput.addEventListener('change', async () => {
        setMessage('');
        editedFile = null;
        selectedFile = mediaInput.files[0] || null;
        if (!selectedFile) {
            clearPreview();
            openEditorButton.disabled = true;
            return;
        }
        const selectionVersion = ++mediaSelectionVersion;
        imageEditor.setActive(false);
        videoEditor.setActive(false);
        const validation = validateFile(selectedFile);
        if (!validation.valid) {
            setMessage(validation.error, true);
            mediaInput.value = '';
            selectedFile = null;
            clearPreview();
            openEditorButton.disabled = true;
            return;
        }

        refreshPreview(selectedFile);
        openEditorButton.disabled = false;
        updateEditorMode(validation.type);

        try {
            if (validation.type === 'image') {
                await imageEditor.load(selectedFile);
            } else {
                await videoEditor.load(selectedFile);
            }
            if (selectionVersion !== mediaSelectionVersion || selectedFile !== mediaInput.files[0]) return;
        } catch (e) {
            setMessage(e.message || 'Impossible de charger le média dans l’éditeur.', true);
            openEditorButton.disabled = true;
        }
    });

    openEditorButton.addEventListener('click', showEditor);
    closeEditorButton.addEventListener('click', hideEditor);
    cancelEditorButton.addEventListener('click', hideEditor);

    undoButton.addEventListener('click', () => activeEditor?.undo());
    redoButton.addEventListener('click', () => activeEditor?.redo());
    resetButton.addEventListener('click', async () => {
        if (!activeEditor) return;
        try {
            await activeEditor.reset();
            setEditorMessage(activeEditorType === 'video' ? 'Vidéo réinitialisée.' : 'Image réinitialisée.');
        } catch (e) {
            setEditorMessage(e.message, true);
        }
    });

    document.getElementById('rotate-left').addEventListener('click', () => activeEditor?.rotate(-90));
    document.getElementById('rotate-right').addEventListener('click', () => activeEditor?.rotate(90));
    document.getElementById('flip-horizontal').addEventListener('click', () => activeEditor?.flip('x'));
    document.getElementById('flip-vertical').addEventListener('click', () => activeEditor?.flip('y'));

    if (playButton) playButton.addEventListener('click', async () => {
        if (activeEditorType !== 'video') return;
        try { videoEditor.togglePlayback(); } catch (e) { setEditorMessage(e.message, true); }
    });

    if (timeline) timeline.addEventListener('input', () => {
        if (activeEditorType === 'video') videoEditor.seek(timeline.value);
    });

    const filterInputs = ['brightness', 'contrast', 'saturation', 'grayscale', 'sepia', 'blur']
        .map(name => document.getElementById(`filter-${name}`));
    filterInputs.forEach(input => input.addEventListener('input', () => activeEditor?.applyFilter(input.dataset.filter, input.value)));
    filterApplyButton.addEventListener('click', async () => {
        if (!activeEditor) return;
        try { await activeEditor.commitFilters(); setEditorMessage('Effets appliqués.'); }
        catch (e) { setEditorMessage(e.message, true); }
    });

    textEmojiToggle?.addEventListener('click', () => {
        if (!textEmojiPicker) return;
        textEmojiPicker.hidden = !textEmojiPicker.hidden;
        textEmojiToggle.setAttribute('aria-expanded', String(!textEmojiPicker.hidden));
    });

    textEmojiPicker?.querySelectorAll('[data-emoji]').forEach(button => {
        button.addEventListener('click', () => {
            const emoji = button.dataset.emoji || '';
            if (!textInput) return;
            const start = textInput.selectionStart ?? textInput.value.length;
            const end = textInput.selectionEnd ?? textInput.value.length;
            textInput.value = textInput.value.slice(0, start) + emoji + textInput.value.slice(end);
            const cursor = start + emoji.length;
            textInput.focus();
            textInput.setSelectionRange(cursor, cursor);
        });
    });

    addTextButton.addEventListener('click', () => {
        try {
            const value = document.getElementById('text-value').value;
            const color = document.getElementById('text-color').value;
            const size = Number(textSizeInput?.value || 58);
            const opacity = Number(textOpacityInput?.value || 100);
            activeEditor?.addText(value, {
                color, size, opacity,
                font: textFontInput?.value || 'Arial',
                weight: textWeightInput?.value || '700',
                fontStyle: textStyleInput?.value || 'normal'
            });
            document.getElementById('text-value').value = '';
            setEditorMessage('Texte ajouté. Cliquez dessus puis faites-le glisser pour le placer.');
        } catch (e) { setEditorMessage(e.message, true); }
    });

    addElementButton.addEventListener('click', () => {
        try {
            const type = document.getElementById('element-type').value;
            const size = Number(elementSizeInput?.value || 96);
            const opacity = Number(elementOpacityInput?.value || 100);
            activeEditor?.addElement(type, { size, opacity, fill: elementColorInput?.value || '#d83ca9' });
            setEditorMessage('Élément ajouté. Cliquez dessus puis faites-le glisser pour le placer.');
        } catch (e) { setEditorMessage(e.message, true); }
    });

    overlayColorInput?.addEventListener('input', () => activeEditor?.setSelectedColor(overlayColorInput.value));

    textSizeInput?.addEventListener('input', () => {
        const value = Number(textSizeInput.value);
        if (textSizeValue) textSizeValue.textContent = String(value);
    });
    textOpacityInput?.addEventListener('input', () => {
        const value = Number(textOpacityInput.value);
        if (textOpacityValue) textOpacityValue.textContent = String(value);
    });
    elementSizeInput?.addEventListener('input', () => {
        const value = Number(elementSizeInput.value);
        if (elementSizeValue) elementSizeValue.textContent = String(value);
    });
    elementOpacityInput?.addEventListener('input', () => {
        const value = Number(elementOpacityInput.value);
        if (elementOpacityValue) elementOpacityValue.textContent = String(value);
    });

    selectedTextSizeInput?.addEventListener('input', () => {
        const value = Number(selectedTextSizeInput.value);
        if (selectedTextSizeValue) selectedTextSizeValue.textContent = String(value);
        activeEditor?.setSelectedOverlaySize(value, false);
    });

    selectedTextSizeInput?.addEventListener('change', () => {
        const value = Number(selectedTextSizeInput.value);
        activeEditor?.setSelectedOverlaySize(value, true);
    });
    selectedOverlayOpacityInput?.addEventListener('input', () => {
        const value = Number(selectedOverlayOpacityInput.value);
        if (selectedOverlayOpacityValue) selectedOverlayOpacityValue.textContent = String(value);
        activeEditor?.setSelectedOpacity(value, false);
    });
    selectedOverlayOpacityInput?.addEventListener('change', () => {
        activeEditor?.setSelectedOpacity(Number(selectedOverlayOpacityInput.value), true);
    });
    const applySelectedTextFormat = () => activeEditor?.setSelectedTextFormat({
        font: selectedTextFont?.value, weight: selectedTextWeight?.value, fontStyle: selectedTextStyle?.value
    }, true);
    selectedTextFont?.addEventListener('change', applySelectedTextFormat);
    selectedTextWeight?.addEventListener('change', applySelectedTextFormat);
    selectedTextStyle?.addEventListener('change', applySelectedTextFormat);
    layerUpButton?.addEventListener('click', () => activeEditor?.moveSelectedLayer(1));
    layerDownButton?.addEventListener('click', () => activeEditor?.moveSelectedLayer(-1));
    layerDeleteButton?.addEventListener('click', () => activeEditor?.deleteSelectedOverlay());

    cropAspectInput?.addEventListener('change', () => activeEditor?.setCropAspect(cropAspectInput.value));

    muteButton?.addEventListener('click', () => {
        if (activeEditorType === 'video') videoEditor.toggleMute();
    });
    volumeInput?.addEventListener('input', () => {
        if (activeEditorType !== 'video') return;
        const value = Number(volumeInput.value);
        if (volumeValue) volumeValue.textContent = String(value);
        videoEditor.setVolume(value, false);
    });
    volumeInput?.addEventListener('change', () => {
        if (activeEditorType === 'video') videoEditor.setVolume(Number(volumeInput.value), true);
    });
    speedInput?.addEventListener('change', () => {
        if (activeEditorType === 'video') videoEditor.setPlaybackRate(Number(speedInput.value), true);
    });

    trimStartInput?.addEventListener('input', () => {
        if (activeEditorType !== 'video') return;
        videoEditor.setTrimStart(trimStartInput.value, false);
    });
    trimStartInput?.addEventListener('change', () => {
        if (activeEditorType !== 'video') return;
        videoEditor.setTrimStart(trimStartInput.value, true);
    });
    trimEndInput?.addEventListener('input', () => {
        if (activeEditorType !== 'video') return;
        videoEditor.setTrimEnd(trimEndInput.value, false);
    });
    trimEndInput?.addEventListener('change', () => {
        if (activeEditorType !== 'video') return;
        videoEditor.setTrimEnd(trimEndInput.value, true);
    });

    cropStartButton.addEventListener('click', () => { if (activeEditor) { activeEditor.setCropAspect(cropAspectInput?.value || 'free'); activeEditor.startCrop(); } setEditorMessage(''); });
    cropCancelButton.addEventListener('click', () => activeEditor?.cancelCrop());
    cropApplyButton.addEventListener('click', () => {
        try {
            activeEditor?.applyCrop();
            setEditorMessage('Recadrage appliqué.');
        } catch (e) { setEditorMessage(e.message, true); }
    });

    applyEditorButton.addEventListener('click', async () => {
        if (!activeEditor) return;
        applyEditorButton.disabled = true;
        try {
            editedFile = await activeEditor.exportFile();
            selectedFile = editedFile;
            refreshPreview(editedFile);
            setMessage(activeEditorType === 'video' ? 'Retouches vidéo appliquées. Vous pouvez maintenant publier.' : 'Retouches appliquées. Vous pouvez maintenant publier.');
            hideEditor();
        } catch (e) {
            setEditorMessage(e.message || 'Impossible d’exporter le média.', true);
        } finally {
            applyEditorButton.disabled = false;
        }
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        setMessage('');
        const file = selectedFile || mediaInput.files[0];
        if (!file) return setMessage('Veuillez sélectionner une photo ou une vidéo.', true);
        const validation = validateFile(file);
        if (!validation.valid) return setMessage(validation.error, true);

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Publication...';

        const formData = new FormData(form);
        formData.delete('media');
        formData.append('media', file);
        if (editedFile && validation.type === 'image') formData.append('editedMedia', 'true');
        if (editedFile && validation.type === 'video') formData.append('editedVideo', 'true');

        try {
            const response = await fetch('/api/publications/upload', {
                method: 'POST',
                credentials: 'include',
                body: formData,
                headers: { Accept: 'application/json' }
            });
            const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {};
            if (!response.ok) throw new Error(data.error || 'Erreur lors de la publication.');
            setMessage('Publication réussie !');
            setTimeout(() => { window.location.href = '/home'; }, 300);
        } catch (error) {
            console.error('Erreur publication :', error);
            setMessage(error.message || 'Une erreur est survenue lors de la publication.', true);
            submitButton.disabled = false;
            submitButton.textContent = 'Publier';
        }
    });
});
