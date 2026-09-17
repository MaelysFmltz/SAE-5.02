/**
 * Controller Conversation
 * Reçoit les requêtes HTTP liées aux conversations, délègue à
 * conversationService, et renvoie le code de statut approprié.
 */

const conversationService = require('../services/conversationService');

/**
 * Parse un idConversation de route en entier valide, ou lève une erreur 400.
 */
function parseIdConversation(raw) {
  const idConversation = Number(raw);

  if (!Number.isInteger(idConversation) || idConversation <= 0) {
    const err = new Error('Identifiant de conversation invalide');
    err.status = 400;
    throw err;
  }

  return idConversation;
}

async function getMyConversations(req, res) {
  try {
    const conversations = await conversationService.getMyConversations(req.user.idUser);
    return res.status(200).json(conversations);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
}

async function createDirect(req, res) {
  try {
    const { idUserDestinataire } = req.body;
    const idConversation = await conversationService.createDirectConversation(
      req.user.idUser,
      idUserDestinataire
    );
    return res.status(201).json({ idConversation });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
}

async function createGroup(req, res) {
  try {
    const { membres, titreGroupe } = req.body;
    const idConversation = await conversationService.createGroupConversation(
      req.user.idUser,
      membres,
      titreGroupe
    );
    return res.status(201).json({ idConversation });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
}

async function getMembers(req, res) {
  try {
    const idConversation = parseIdConversation(req.params.idConversation);
    const membres = await conversationService.getConversationMembers(idConversation, req.user.idUser);
    return res.status(200).json({ membres });
  } catch (err) {
    return res.status(err.status || 403).json({ error: err.message });
  }
}

async function addParticipants(req, res) {
  try {
    const idConversation = parseIdConversation(req.params.idConversation);
    const { idUsers } = req.body;

    const membres = await conversationService.addParticipants(
      idConversation,
      req.user.idUser,
      idUsers
    );

    return res.status(200).json({ membres });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
}

async function removeParticipant(req, res) {
  try {
    const idConversation = parseIdConversation(req.params.idConversation);
    const idUser = Number(req.params.idUser);

    const membres = await conversationService.removeParticipant(
      idConversation,
      req.user.idUser,
      idUser
    );

    return res.status(200).json({ membres });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
}

async function renameGroup(req, res) {
  try {
    const idConversation = parseIdConversation(req.params.idConversation);
    const { titreGroupe } = req.body;

    const nouveauTitre = await conversationService.renameGroup(
      idConversation,
      req.user.idUser,
      titreGroupe
    );

    return res.status(200).json({ titreGroupe: nouveauTitre });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
}

module.exports = {
  getMyConversations,
  createDirect,
  createGroup,
  getMembers,
  addParticipants,
  removeParticipant,
  renameGroup
};
