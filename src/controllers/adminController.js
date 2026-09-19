const db = require('../config/database');
const userService = require('../services/userService');
const userModel = require('../models/userModel');

/**
 * Récupère la liste de tous les utilisateurs (pour le tableau d'administration/modération).
 */
function obtenirUtilisateurs(req, res) {
    try {
        const utilisateurs = userService.obtenirUtilisateurs(db);
        return res.status(200).json(utilisateurs);
    } catch (error) {
        console.error('Erreur obtenirUtilisateurs :', error);
        return res.status(500).json({ erreur: 'Erreur lors de la récupération des utilisateurs' });
    }
}

/**
 * Modifie le statut d'un utilisateur (actif, suspendu, banni, supprime).
 * Les modérateurs peuvent suspendre/réactiver/bannir.
 * La suppression définitive de compte ('supprime') est réservée aux administrateurs et superadmin.
 */
function modifierStatutUtilisateur(req, res) {
    const idUser = Number(req.params.idUser);
    const { statut } = req.body;
    const operateurRole = req.user.role;

    if (statut === 'supprime' && !['admin', 'superadmin'].includes(operateurRole)) {
        return res.status(403).json({
            erreur: 'La suppression définitive d’un compte est réservée aux administrateurs.'
        });
    }

    const resultat = userService.modifierStatut(
        db,
        idUser,
        statut,
        req.user.idUser
    );

    if (!resultat.succes) {
        return res.status(400).json({
            erreur: resultat.erreur
        });
    }

    return res.status(200).json({
        message: 'Statut utilisateur modifié avec succès'
    });
}

/**
 * Modifie le rôle d'un utilisateur.
 * Un administrateur peut promouvoir ou rétrograder un 'moderator' ou un 'user'.
 * Seul le superadmin peut nommer ou rétrograder un 'admin'.
 */
function modifierRoleUtilisateur(req, res) {
    const idUser = Number(req.params.idUser);
    const { role } = req.body;
    const operateurRole = req.user.role;

    const rolesValides = ['user', 'moderator', 'admin'];
    if (!rolesValides.includes(role)) {
        return res.status(400).json({ erreur: 'Rôle demandé invalide.' });
    }

    if (!Number.isInteger(idUser) || idUser <= 0) {
        return res.status(400).json({ erreur: 'Identifiant utilisateur invalide.' });
    }

    const cible = userModel.findById(db, idUser);
    if (!cible) {
        return res.status(404).json({ erreur: 'Utilisateur introuvable.' });
    }

    // Protection : un admin ne peut pas rétrograder un autre admin ni nommer un admin
    if (operateurRole === 'admin' && (role === 'admin' || cible.role === 'admin')) {
        return res.status(403).json({
            erreur: 'Seul le superadmin peut nommer ou modifier le rôle d’un administrateur.'
        });
    }

    userModel.updateRole(idUser, role, db);

    return res.status(200).json({
        message: `Rôle mis à jour avec succès : l'utilisateur est maintenant ${role}.`
    });
}

module.exports = {
    obtenirUtilisateurs,
    modifierStatutUtilisateur,
    modifierRoleUtilisateur
};