(() => {
  'use strict';

  function getPublicationContainer(element) {
    return element.closest('[data-publication-id]');
  }

  function setFeedback(container, message, isError = false) {
    const feedback = container.querySelector('[data-publication-feedback]');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.toggle('is-error', isError);
  }

  function updateCaptionUI(container, caption) {
    const display = container.querySelector('[data-caption-display]');
    const text = container.querySelector('[data-caption-text]');
    const input = container.querySelector('[data-caption-input]');
    const editor = container.querySelector('[data-caption-editor]');
    const editButton = container.querySelector('[data-publication-action="edit-caption"]');
    const deleteButton = container.querySelector('[data-publication-action="delete-caption"]');

    if (text) text.textContent = caption || '';
    if (display) display.hidden = !caption;
    if (input) input.value = caption || '';
    if (editor) editor.hidden = true;
    if (editButton) editButton.textContent = caption ? '✏️ Modifier la légende' : '＋ Ajouter une légende';
    if (deleteButton) deleteButton.hidden = !caption;
  }

  function updateCommentsUI(container, enabled) {
    const toggleButton = container.querySelector('[data-publication-action="toggle-comments"]');
    const commentButton = container.querySelector('[data-comment-open]');

    if (toggleButton) {
      toggleButton.dataset.enabled = enabled ? '1' : '0';
      toggleButton.textContent = enabled ? 'Désactiver les commentaires' : 'Activer les commentaires';
    }

    if (commentButton) {
      commentButton.disabled = !enabled;
      commentButton.classList.toggle('comments-disabled', !enabled);
      commentButton.title = enabled ? 'Commentaires' : 'Commentaires désactivés';
      commentButton.setAttribute('aria-label', commentButton.title);
      const count = commentButton.querySelector('[data-comment-count]');
      if (count) {
        if (!count.dataset.count) {
          const visibleCount = count.textContent.trim();
          count.dataset.count = visibleCount === 'Désactivés' ? '0' : visibleCount;
        }
        count.textContent = enabled ? count.dataset.count : 'Désactivés';
      }
    }

    const detailButton = container.querySelector('[data-post-comment-toggle]');
    if (detailButton) {
      detailButton.hidden = !enabled;
    }

    const disabledNotice = container.querySelector('[data-comments-disabled-notice]');
    if (disabledNotice) disabledNotice.hidden = enabled;

    const commentsSection = container.querySelector('#commentsSection');
    if (commentsSection) {
      commentsSection.hidden = !enabled;
      if (!enabled) commentsSection.classList.remove('open');
    }
    const commentsForm = container.querySelector('.form-comment');
    if (commentsForm) commentsForm.hidden = !enabled;
  }

  async function sendPublicationAction(container, action, options = {}) {
    const idPubli = Number(container.dataset.publicationId);
    if (!Number.isInteger(idPubli) || idPubli <= 0) {
      throw new Error('Identifiant de publication invalide.');
    }

    const response = await fetch(`/api/publications/${idPubli}/${action}`, {
      method: options.method || 'PATCH',
      credentials: 'same-origin',
      headers: options.body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Impossible de modifier cette publication.');
    }
    return data;
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-publication-action]');
    if (!button) return;

    const container = getPublicationContainer(button);
    if (!container) return;

    const action = button.dataset.publicationAction;

    if (action === 'edit-caption') {
      const editor = container.querySelector('[data-caption-editor]');
      const input = container.querySelector('[data-caption-input]');
      if (!editor || !input) return;
      editor.hidden = false;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      return;
    }

    if (action === 'cancel-caption') {
      const editor = container.querySelector('[data-caption-editor]');
      const input = container.querySelector('[data-caption-input]');
      const current = container.querySelector('[data-caption-text]');
      if (input) input.value = current?.textContent || '';
      if (editor) editor.hidden = true;
      setFeedback(container, '');
      return;
    }

    if (action === 'save-caption') {
      const input = container.querySelector('[data-caption-input]');
      if (!input) return;
      const caption = input.value.trim();
      if (caption.length > 5000) {
        setFeedback(container, 'La légende ne peut pas dépasser 5000 caractères.', true);
        return;
      }
      button.disabled = true;
      try {
        await sendPublicationAction(container, 'legende', {
          body: { contenuPub: caption || null }
        });
        updateCaptionUI(container, caption);
        setFeedback(container, caption ? 'Légende enregistrée.' : 'Légende supprimée.');
      } catch (error) {
        setFeedback(container, error.message, true);
      } finally {
        button.disabled = false;
      }
      return;
    }

    if (action === 'delete-caption') {
      if (!window.confirm('Supprimer la légende de cette publication ?')) return;
      button.disabled = true;
      try {
        await sendPublicationAction(container, 'legende', { method: 'DELETE' });
        updateCaptionUI(container, '');
        setFeedback(container, 'Légende supprimée.');
      } catch (error) {
        setFeedback(container, error.message, true);
      } finally {
        button.disabled = false;
      }
      return;
    }

    if (action === 'toggle-comments') {
      const currentEnabled = button.dataset.enabled !== '0';
      const nextEnabled = !currentEnabled;
      button.disabled = true;
      try {
        await sendPublicationAction(container, 'commentaires', {
          body: { commentairesActifs: nextEnabled ? 1 : 0 }
        });
        updateCommentsUI(container, nextEnabled);
        setFeedback(container, nextEnabled ? 'Commentaires activés.' : 'Commentaires désactivés.');
        if (container.classList.contains('post-card') && nextEnabled) {
          window.location.reload();
        }
      } catch (error) {
        setFeedback(container, error.message, true);
      } finally {
        button.disabled = false;
      }
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-comment-open]').forEach((button) => {
      const container = getPublicationContainer(button);
      if (container) {
        const count = button.querySelector('[data-comment-count]');
        if (count && !count.dataset.count) {
        const visibleCount = count.textContent.trim();
        count.dataset.count = visibleCount === 'Désactivés' ? '0' : visibleCount;
      }
      }
    });
  });
})();
