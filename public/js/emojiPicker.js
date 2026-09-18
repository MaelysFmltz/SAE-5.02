/*
 * Petit clavier d'émojis réutilisable, attaché à un champ texte
 * (commentaires, et plus tard messagerie). Insère l'émoji choisi
 * à la position du curseur, sans dépendance externe.
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

    function createPanel() {
        const panel = document.createElement('div');
        panel.className = 'emoji-picker-panel';
        panel.hidden = true;

        EMOJIS.forEach((emoji) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'emoji-picker-item';
            btn.textContent = emoji;
            panel.appendChild(btn);
        });

        return panel;
    }

    function insertAtCursor(input, emoji) {
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;

        input.value =
            input.value.slice(0, start) + emoji + input.value.slice(end);

        const newPos = start + emoji.length;
        input.setSelectionRange(newPos, newPos);
        input.focus();

        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * Attache un bouton 😊 + panneau d'émojis juste avant
     * `insertBeforeEl`, insérant les émojis choisis dans `input`.
     */
    window.attachEmojiPicker = function attachEmojiPicker(input, insertBeforeEl) {
        if (!input || !insertBeforeEl || !insertBeforeEl.parentNode) {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'emoji-picker-wrapper';

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'emoji-picker-toggle';
        toggleBtn.setAttribute('aria-label', 'Insérer un émoji');
        toggleBtn.textContent = '😊';

        const panel = createPanel();

        wrapper.appendChild(toggleBtn);
        wrapper.appendChild(panel);

        insertBeforeEl.parentNode.insertBefore(wrapper, insertBeforeEl);

        toggleBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            panel.hidden = !panel.hidden;
        });

        panel.addEventListener('click', (event) => {
            const item = event.target.closest('.emoji-picker-item');

            if (!item) {
                return;
            }

            insertAtCursor(input, item.textContent);
        });

        document.addEventListener('click', (event) => {
            if (!wrapper.contains(event.target)) {
                panel.hidden = true;
            }
        });
    };

})();
