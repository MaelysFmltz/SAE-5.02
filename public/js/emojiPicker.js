/*
 * Petit clavier d'émojis réutilisable, attaché à un champ texte
 * (commentaires, et plus tard messagerie). Insère l'émoji choisi
 * à la position du curseur, sans dépendance externe.
 *
 * Le panneau est ajouté à document.body et positionné en "fixed"
 * (comme hashtagSuggest.js), pour ne jamais être coupé par un
 * ancêtre en overflow:hidden (ex : la feuille de la modale de
 * commentaires) et pour toujours rester visible et défilable.
 */
(function () {

    const EMOJIS = [
        '😀', '😂', '🥰', '😍', '😘', '😉', '😊', '🙂', '😎', '🤔',
        '😢', '😭', '😡', '😱', '🥳', '😴', '🤗', '🤩', '😜', '🙄',
        '👍', '👎', '👏', '🙏', '💪', '🤝', '👋', '✌️', '🤙', '👀',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💯',
        '🔥', '✨', '🎉', '🎊', '⭐', '🌟', '💥', '💫', '🥇', '🏆',
        '📷', '🎥', '🎵', '🎶', '🐶', '🐱', '🌸', '🌈', '☀️', '🌙'
    ];

    /**
     * Attache un bouton 😊 + panneau d'émojis juste avant
     * `insertBeforeEl`, insérant les émojis choisis dans `input`.
     */
    window.attachEmojiPicker = function attachEmojiPicker(input, insertBeforeEl) {
        if (!input || !insertBeforeEl || !insertBeforeEl.parentNode) {
            return;
        }

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'emoji-picker-toggle';
        toggleBtn.setAttribute('aria-label', 'Insérer un émoji');
        toggleBtn.textContent = '😊';

        insertBeforeEl.parentNode.insertBefore(toggleBtn, insertBeforeEl);

        const panel = document.createElement('div');
        panel.className = 'emoji-picker-panel';
        panel.hidden = true;

        const header = document.createElement('div');
        header.className = 'emoji-picker-header';

        const title = document.createElement('span');
        title.textContent = 'Émojis';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'emoji-picker-close';
        closeBtn.setAttribute('aria-label', 'Fermer les émojis');
        closeBtn.textContent = '✕';

        header.appendChild(title);
        header.appendChild(closeBtn);
        panel.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'emoji-picker-grid';

        EMOJIS.forEach((emoji) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'emoji-picker-item';
            btn.textContent = emoji;
            grid.appendChild(btn);
        });

        panel.appendChild(grid);
        document.body.appendChild(panel);

        function positionPanel() {
            const rect = toggleBtn.getBoundingClientRect();
            const panelWidth = Math.min(260, window.innerWidth - 16);

            panel.style.width = `${panelWidth}px`;

            let left = rect.right - panelWidth;
            left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
            panel.style.left = `${left}px`;

            /*
             * Hauteur FIXE (pas max-height) : la grille est ensuite
             * positionnée en absolu à l'intérieur, du bas du header
             * jusqu'au bas du panneau, avec son propre overflow-y.
             * Ça évite toute ambiguïté de calcul flexbox (basis,
             * min-height...) qui a posé problème jusqu'ici.
             */
            const desiredHeight = 320;

            /*
             * Ouvre vers le haut par défaut (le champ est souvent en
             * bas de l'écran), et vers le bas s'il n'y a pas assez
             * de place au-dessus.
             */
            const spaceAbove = rect.top - 16;
            const spaceBelow = window.innerHeight - rect.bottom - 16;

            let height;

            if (spaceAbove >= 160) {
                height = Math.min(desiredHeight, spaceAbove);
                panel.style.top = 'auto';
                panel.style.bottom = `${window.innerHeight - rect.top + 8}px`;
            } else {
                height = Math.min(desiredHeight, Math.max(160, spaceBelow));
                panel.style.bottom = 'auto';
                panel.style.top = `${rect.bottom + 8}px`;
            }

            panel.style.height = `${height}px`;
            grid.style.top = `${header.offsetHeight}px`;
        }

        function open() {
            panel.hidden = false;
            positionPanel();
        }

        function close() {
            panel.hidden = true;
        }

        toggleBtn.addEventListener('click', (event) => {
            event.stopPropagation();

            if (panel.hidden) {
                open();
            } else {
                close();
            }
        });

        closeBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            close();
        });

        grid.addEventListener('click', (event) => {
            const item = event.target.closest('.emoji-picker-item');

            if (!item) {
                return;
            }

            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? input.value.length;

            input.value =
                input.value.slice(0, start) + item.textContent + input.value.slice(end);

            const newPos = start + item.textContent.length;
            input.setSelectionRange(newPos, newPos);
            input.focus();

            input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        document.addEventListener('click', (event) => {
            if (
                !panel.hidden &&
                event.target !== toggleBtn &&
                !panel.contains(event.target)
            ) {
                close();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !panel.hidden) {
                close();
            }
        });

        window.addEventListener('resize', () => {
            if (!panel.hidden) {
                positionPanel();
            }
        });
    };

})();
