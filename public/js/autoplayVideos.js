/*
 * Lance automatiquement la lecture des vidéos du feed quand elles
 * sont visibles à l'écran, et les met en pause quand on les quitte
 * (comme un feed type réseau social). Les vidéos sont muettes par
 * défaut (obligatoire pour l'autoplay des navigateurs) ; l'utilisateur
 * peut toujours les démarrer/couper le son manuellement.
 */
document.addEventListener('DOMContentLoaded', () => {

    const videos = document.querySelectorAll('video.auto-video');

    if (!videos.length || !('IntersectionObserver' in window)) {
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                const video = entry.target;

                if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            });
        },
        { threshold: [0, 0.6, 1] }
    );

    videos.forEach((video) => observer.observe(video));
});
