/* ==========================================
   RETOUR EN HAUT DU FIL D'ACTUALITÉ
========================================== */

(() => {
    'use strict';

    function initialiserRetourEnHaut() {
        const button = document.getElementById('back-to-top');

        if (!button) {
            return;
        }

        const seuilAffichage = 300;
        let animationFrameEnAttente = false;
        let timerMasquage = null;

        function mettreAJourBouton() {
            const doitAfficher = window.scrollY > seuilAffichage;

            if (doitAfficher) {
                if (timerMasquage !== null) {
                    window.clearTimeout(timerMasquage);
                    timerMasquage = null;
                }

                button.hidden = false;
                window.requestAnimationFrame(() => {
                    button.classList.add('is-visible');
                });
            } else {
                button.classList.remove('is-visible');

                if (timerMasquage !== null) {
                    window.clearTimeout(timerMasquage);
                }

                timerMasquage = window.setTimeout(() => {
                    if (window.scrollY <= seuilAffichage) {
                        button.hidden = true;
                    }
                    timerMasquage = null;
                }, 220);
            }
        }

        window.addEventListener('scroll', () => {
            if (animationFrameEnAttente) {
                return;
            }

            animationFrameEnAttente = true;
            window.requestAnimationFrame(() => {
                mettreAJourBouton();
                animationFrameEnAttente = false;
            });
        }, { passive: true });

        button.addEventListener('click', () => {
            const prefersReducedMotion = window.matchMedia
                && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            window.scrollTo({
                top: 0,
                behavior: prefersReducedMotion ? 'auto' : 'smooth'
            });
        });

        mettreAJourBouton();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialiserRetourEnHaut, { once: true });
    } else {
        initialiserRetourEnHaut();
    }
})();

