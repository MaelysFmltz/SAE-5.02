const userService = require('../services/userService');
const userModel = require('../models/userModel');
const blockService = require('../services/blockService');

async function updatePseudo(req, res) {
  try {
    const { pseudo } = req.body;
    const updatedPseudo = await userService.changePseudo(req.user.idUser, pseudo);

    if (req.session?.user) {
      req.session.user.pseudo = updatedPseudo;
    }

    return res.status(200).json({ success: true, pseudo: updatedPseudo });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

async function updateEmail(req, res) {
  try {
    const { email } = req.body;
    const updatedEmail = await userService.changeEmail(req.user.idUser, email);

    if (req.session?.user) {
      req.session.user.email = updatedEmail;
    }

    return res.status(200).json({ success: true, email: updatedEmail });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

async function updatePassword(req, res) {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    await userService.changePassword(
      req.user.idUser,
      oldPassword,
      newPassword,
      confirmPassword
    );

    return res.status(200).json({
      success: true,
      message: 'Mot de passe mis à jour avec succès.'
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

async function deleteAccount(req, res) {
  try {
    const { password } = req.body;
    await userService.removeAccount(req.user.idUser, password);

    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        return res.status(200).json({ success: true, redirect: '/' });
      });
    } else {
      res.clearCookie('token');
      return res.status(200).json({ success: true, redirect: '/' });
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

async function searchUsersAdmin(req, res) {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.idUser !== -999) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }

    const query = req.query.q || '';
    if (!query.trim()) {
      return res.json({ users: [] });
    }

    const users = userModel.searchUsers(query.trim());
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function changeUserRoleAdmin(req, res) {
  try {
    const isSuperAdmin = req.user.role === 'superadmin' || req.user.idUser === -999;
    const isAdmin = req.user.role === 'admin' || isSuperAdmin;

    if (!isAdmin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }

    const { idUser, role } = req.body;
    const targetId = Number(idUser);

    const allowedRoles = isSuperAdmin ? ['user', 'moderator', 'admin'] : ['user', 'moderator'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide ou non assignable depuis votre compte.' });
    }

    const targetUser = userModel.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    if (targetId === req.user.idUser) {
      return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre rôle.' });
    }

    if (!isSuperAdmin && targetUser.role === 'admin') {
      return res.status(403).json({ error: 'Impossible de modifier le rôle d’un administrateur.' });
    }

    userModel.updateRole(targetId, role);
    return res.json({ success: true, message: 'Rôle mis à jour avec succès.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Récupère la liste des comptes bloqués par l'utilisateur connecté (pour settings.ejs).
 */
function getBlockedUsers(req, res) {
  try {
    const list = blockService.listerBloques(req.user.idUser);
    return res.status(200).json({ blockedUsers: list });
  } catch (error) {
    console.error('Erreur getBlockedUsers :', error);
    return res.status(500).json({ error: 'Impossible de récupérer la liste des comptes bloqués.' });
  }
}

/**
 * Bloque un compte utilisateur cible.
 */
function blockUser(req, res) {
  try {
    const targetId = Number(req.params.idUser);
    const result = blockService.bloquerUtilisateur(req.user.idUser, targetId);

    if (!result.succes) {
      return res.status(400).json({ error: result.erreur });
    }

    return res.status(200).json({ message: 'Utilisateur bloqué avec succès.' });
  } catch (error) {
    console.error('Erreur blockUser :', error);
    return res.status(500).json({ error: 'Erreur lors du blocage.' });
  }
}

/**
 * Débloque un compte utilisateur cible.
 */
function unblockUser(req, res) {
  try {
    const targetId = Number(req.params.idUser);
    const result = blockService.debloquerUtilisateur(req.user.idUser, targetId);

    if (!result.succes) {
      return res.status(400).json({ error: result.erreur });
    }

    return res.status(200).json({ message: 'Utilisateur débloqué avec succès.' });
  } catch (error) {
    console.error('Erreur unblockUser :', error);
    return res.status(500).json({ error: 'Erreur lors du déblocage.' });
  }
}

module.exports = {
  updatePseudo,
  updateEmail,
  updatePassword,
  deleteAccount,
  searchUsersAdmin,
  changeUserRoleAdmin,
  getBlockedUsers,
  blockUser,
  unblockUser
};