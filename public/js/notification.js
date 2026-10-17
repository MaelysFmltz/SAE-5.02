/**
 * Affiche la pastille de notifications non lues sur la cloche du header du feed.
 * Chargé par feed.ejs. Ne fait rien si la pastille n'existe pas dans la page.
 */
(async function afficherPastille() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;

  try {
    const res = await fetch('/api/notifications/unread-count');
    if (!res.ok) return;

    const data = await res.json();
    if (data.count > 0) {
      badge.textContent = data.count > 9 ? '9+' : String(data.count);
      badge.hidden = false;
    }
  } catch (err) {
    console.error('Erreur chargement des notifications :', err);
  }
})();