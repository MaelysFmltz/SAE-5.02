import { ImageEditor } from './editor/imageEditor.js';

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
    const dimensions = document.getElementById('editor-dimensions');
    const editorMessage = document.getElementById('editor-message');
    const editorFileName = document.getElementById('editor-file-name');
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
    const resizeButton = document.getElementById('resize-apply');
    const addTextButton = document.getElementById('add-text');
    const addElementButton = document.getElementById('add-element');
    const filterApplyButton = document.getElementById('filters-apply');

    if (!form || !mediaInput) return;

    const IMAGE_MAX_SIZE = 20 * 1024 * 1024;
    const VIDEO_MAX_SIZE = 100 * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    let previewUrl = null;
    let selectedFile = null;
    let editedFile = null;

    const editor = new ImageEditor({ canvas: editorCanvas, cropOverlay, cropHint, dimensions }, {
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
        imagePreview.src = ''; videoPreview.removeAttribute('src'); videoPreview.load();
        imagePreview.style.display = 'none'; videoPreview.style.display = 'none'; previewContainer.style.display = 'none';
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
        clearPreview(); previewUrl = URL.createObjectURL(file); previewContainer.style.display = 'block';
        if (mediaType(file) === 'image') { imagePreview.src = previewUrl; imagePreview.style.display = 'block'; }
        else { videoPreview.src = previewUrl; videoPreview.style.display = 'block'; videoPreview.load(); }
    }
    function showEditor() {
        if (!selectedFile || mediaType(selectedFile) !== 'image') return;

        editorFileName.textContent = selectedFile.name;
        editorModal.hidden = false;
        document.body.classList.add('editor-open');
        setEditorMessage('');
    }

    function hideEditor() {
        editorModal.hidden = true;
        editor.cancelCrop();
        document.body.classList.remove('editor-open');
        setEditorMessage('');
    }

    mediaInput.addEventListener('change', async () => {
        setMessage(''); editedFile = null; selectedFile = mediaInput.files[0] || null;
        if (!selectedFile) { clearPreview(); openEditorButton.disabled = true; return; }
        const validation = validateFile(selectedFile);
        if (!validation.valid) { setMessage(validation.error, true); mediaInput.value = ''; selectedFile = null; clearPreview(); openEditorButton.disabled = true; return; }
        refreshPreview(selectedFile);
        openEditorButton.disabled = validation.type !== 'image';
        if (validation.type === 'image') {
            try {
                await editor.load(selectedFile);
                document.getElementById('resize-width').value = editor.image.width;
                document.getElementById('resize-height').value = editor.image.height;
            } catch (e) { setMessage('Impossible de charger l’image dans l’éditeur.', true); openEditorButton.disabled = true; }
        }
    });

    openEditorButton.addEventListener('click', showEditor);
    closeEditorButton.addEventListener('click', hideEditor);
    cancelEditorButton.addEventListener('click', hideEditor);
    undoButton.addEventListener('click', () => editor.undo());
    redoButton.addEventListener('click', () => editor.redo());
    resetButton.addEventListener('click', async () => { try { await editor.reset(); setEditorMessage('Image réinitialisée.'); } catch (e) { setEditorMessage(e.message, true); } });
    document.getElementById('rotate-left').addEventListener('click', () => editor.rotate(-90));
    document.getElementById('rotate-right').addEventListener('click', () => editor.rotate(90));
    document.getElementById('flip-horizontal').addEventListener('click', () => editor.flip('x'));
    document.getElementById('flip-vertical').addEventListener('click', () => editor.flip('y'));

    const filterInputs = ['brightness','contrast','saturation','grayscale','sepia','blur'].map(name => document.getElementById(`filter-${name}`));
    filterInputs.forEach(input => input.addEventListener('input', () => editor.applyFilter(input.dataset.filter, input.value)));
    filterApplyButton.addEventListener('click', async () => { try { await editor.commitFilters(); setEditorMessage('Effets appliqués.'); } catch (e) { setEditorMessage(e.message, true); } });

    resizeButton.addEventListener('click', async () => {
        try { await editor.resize(document.getElementById('resize-width').value, document.getElementById('resize-height').value); setEditorMessage('Image redimensionnée.'); }
        catch (e) { setEditorMessage(e.message, true); }
    });
    addTextButton.addEventListener('click', async () => {
        try { const value = document.getElementById('text-value').value; const color = document.getElementById('text-color').value; await editor.addText(value, { color }); document.getElementById('text-value').value = ''; setEditorMessage('Texte ajouté au centre de l’image.'); }
        catch (e) { setEditorMessage(e.message, true); }
    });
    addElementButton.addEventListener('click', async () => {
        try { const type = document.getElementById('element-type').value; const value = document.getElementById('element-emoji').value || '✨'; await editor.addElement(type, { value }); setEditorMessage('Élément ajouté au centre de l’image.'); }
        catch (e) { setEditorMessage(e.message, true); }
    });

    cropStartButton.addEventListener('click', () => { editor.startCrop(); setEditorMessage(''); });
    cropCancelButton.addEventListener('click', () => editor.cancelCrop());
    cropApplyButton.addEventListener('click', async () => { try { await editor.applyCrop(); setEditorMessage('Recadrage appliqué.'); } catch (e) { setEditorMessage(e.message, true); } });

    applyEditorButton.addEventListener('click', async () => {
        try {
            editedFile = await editor.exportFile();
            selectedFile = editedFile;
            refreshPreview(editedFile);
            setMessage('Retouches appliquées. Vous pouvez maintenant publier.');
            hideEditor();
        } catch (e) { setEditorMessage(e.message || 'Impossible d’exporter l’image.', true); }
    });

    form.addEventListener('submit', async event => {
        event.preventDefault(); setMessage('');
        const file = selectedFile || mediaInput.files[0];
        if (!file) return setMessage('Veuillez sélectionner une photo ou une vidéo.', true);
        const validation = validateFile(file);
        if (!validation.valid) return setMessage(validation.error, true);
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true; submitButton.textContent = 'Publication...';
        // L'authentification actuelle du projet utilise un cookie JWT httpOnly.
        // Il n'est donc ni nécessaire ni possible de le lire depuis JavaScript.
        // credentials: 'include' permet au navigateur de transmettre le cookie.
        const formData = new FormData(form);
        formData.delete('media');
        formData.append('media', file);
        if (editedFile) formData.append('editedMedia', 'true');

        try {
            const response = await fetch('/post/upload', {
                method: 'POST',
                credentials: 'include',
                body: formData,
                headers: {
                    Accept: 'application/json'
                }
            });
            const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {};
            if (!response.ok) throw new Error(data.error || 'Erreur lors de la publication.');
            setMessage('Publication réussie !');
            setTimeout(() => { window.location.href = '/home'; }, 300);
        } catch (error) { console.error('Erreur publication :', error); setMessage(error.message || 'Une erreur est survenue lors de la publication.', true); submitButton.disabled = false; submitButton.textContent = 'Publier'; }
    });
});
