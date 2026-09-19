export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Impossible de générer l’image.')), type, quality));
}
export function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Lecture impossible.'));
        reader.readAsDataURL(blob);
    });
}
export function dataURLToImage(dataURL) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Image invalide.'));
        image.src = dataURL;
    });
}
export function createFileFromBlob(blob, originalName = 'photo') {
    const base = originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'photo';
    return new File([blob], `${base}-editee.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}
