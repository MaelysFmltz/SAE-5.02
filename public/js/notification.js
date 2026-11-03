/**
 * Affiche les pastilles :
 *  - #notif-badge : notifications non lues (cloche du header du feed)
 *  - #msg-badge   : conversations avec messages non lus (bouton Messagerie du bas)
 * Chargé par navbar.ejs. Chaque pastille est ignorée si elle n'existe pas dans la page.
 */
(async function afficherPastilles() {
  const notifBadge = document.getElementById('notif-badge');
  const msgBadge = document.getElementById('msg-badge');
  if (!notifBadge && !msgBadge) return;

  function afficher(badge, nombre) {
    if (!badge || !nombre || nombre <= 0) return;
    badge.textContent = nombre > 9 ? '9+' : String(nombre);
    badge.hidden = false;
  }

  try {
    const res = await fetch('/api/notifications/unread-count');
    if (!res.ok) return;

    const data = await res.json();
    afficher(notifBadge, data.count);
    afficher(msgBadge, data.messages);
  } catch (err) {
    console.error('Erreur chargement des pastilles :', err);
  }
})();