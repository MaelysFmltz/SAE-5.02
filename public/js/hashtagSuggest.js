/*
 * Suggestions de hashtags existants/populaires pendant la saisie
 * d'une publication ou d'un commentaire. Réutilisable sur n'importe
 * quel <input>/<textarea> contenant du texte libre.
 */
window.attachHashtagSuggest = function attachHashtagSuggest(input) {
    if (!input || input.dataset.hashtagSuggestAttached) {
        return;
    }

    input.dataset.hashtagSuggestAttached = 'true';

    /*
     * Le panneau est ajouté à document.body et positionné en
     * "fixed" au-dessus du champ, pour ne jamais perturber la
     * mise en page (flex, formulaires) là où le champ est utilisé.
     */
    const dropdown = document.createElement('div');
    dropdown.className = 'hashtag-suggest-dropdown';
    dropdown.hidden = true;
    document.body.appendChild(dropdown);

    function positionDropdown() {
        const rect = input.getBoundingClientRect();
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.width = `${rect.width}px`;

        /*
         * Toujours au-dessus du champ : sur un petit écran, le champ
         * de commentaire est souvent tout en bas et une liste
         * affichée en dessous sort de l'écran (invisible).
         */
        const spaceAbove = rect.top;
        const maxHeight = 220;

        if (spaceAbove >= 120) {
            dropdown.style.top = 'auto';
            dropdown.style.bottom = `${window.innerHeight - rect.top + 4}px`;
            dropdown.style.maxHeight = `${Math.min(maxHeight, spaceAbove - 8)}px`;
        } else {
            // Vraiment pas de place au-dessus : on affiche en dessous.
            dropdown.style.bottom = 'auto';
            dropdown.style.top = `${rect.bottom + 4}px`;
            dropdown.style.maxHeight =
                `${Math.max(80, window.innerHeight - rect.bottom - 8)}px`;
        }
    }

    window.addEventListener('resize', () => {
        if (!dropdown.hidden) {
            positionDropdown();
        }
    });

    window.addEventListener('scroll', () => {
        if (!dropdown.hidden) {
            positionDropdown();
        }
    }, true);

    let debounceTimer = null;

    function getCurrentTag() {
        const pos = input.selectionStart ?? input.value.length;
        const before = input.value.slice(0, pos);
        const match = before.match(/#([a-zA-Z0-9_À-ſ]*)$/);

        if (!match) {
            return null;
        }

        return {
            tag: match[1],
            start: pos - match[0].length,
            end: pos
        };
    }

    function hide() {
        dropdown.hidden = true;
        dropdown.innerHTML = '';
    }

    function selectSuggestion(nom, tagInfo) {
        const before = input.value.slice(0, tagInfo.start);
        const after = input.value.slice(tagInfo.end);

        input.value = `${before}#${nom} ${after}`;

        const newPos = before.length + nom.length + 2;
        input.focus();
        input.setSelectionRange(newPos, newPos);

        hide();
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);

        const current = getCurrentTag();

        if (!current || !current.tag) {
            hide();
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/search/hashtags?prefix=${encodeURIComponent(current.tag)}`
                );

                if (!res.ok) {
                    return;
                }

                const suggestions = await res.json();

                if (!Array.isArray(suggestions) || suggestions.length === 0) {
                    hide();
                    return;
                }

                dropdown.innerHTML = suggestions.map((s) => `
                    <button type="button" class="hashtag-suggest-item" data-nom="${s.nom}">
                        <span>#${s.nom}</span>
                        <span class="hashtag-suggest-count">${s.nbPosts}</span>
                    </button>
                `).join('');

                positionDropdown();
                dropdown.hidden = false;
            } catch (err) {
                console.error('Erreur suggestions hashtags :', err);
            }
        }, 200);
    });

    dropdown.addEventListener('mousedown', (event) => {
        // Empêche l'input de perdre le focus (et donc la sélection en
        // cours) avant que le clic sur la suggestion soit traité.
        event.preventDefault();
    });

    dropdown.addEventListener('click', (event) => {
        const item = event.target.closest('.hashtag-suggest-item');

        if (!item) {
            return;
        }

        const tagInfo = getCurrentTag();

        if (tagInfo) {
            selectSuggestion(item.dataset.nom, tagInfo);
        }
    });

    document.addEventListener('click', (event) => {
        if (event.target !== input && !dropdown.contains(event.target)) {
            hide();
        }
    });

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hide();
        }
    });
};
