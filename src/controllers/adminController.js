const db = require('../config/database');
const userService = require('../services/userService');
const userModel = require('../models/userModel');

function obtenirUtilisateurs(req, res) {
    try {
        const utilisateurs = userService.obtenirUtilisateurs(db);
        return res.status(200).json(utilisateurs);
    } catch (error) {
        console.error('Erreur obtenirUtilisateurs :', error);
        return res.status(500).json({ erreur: 'Erreur lors de la récupération des utilisateurs' });
    }
}

function modifierStatutUtilisateur(req, res) {
    const idUser = Number(req.params.idUser);
    const { statut } = req.body;

    const statutsValides = ['actif', 'suspendu', 'supprime'];
    if (!statutsValides.includes(statut)) {
        return res.status(400).json({
            erreur: 'Statut invalide. Valeurs acceptées : actif, suspendu, supprime.'
        });
    }

    const operateurRole = req.user.role;
    if (statut === 'supprime' && !['admin', 'superadmin'].includes(operateurRole)) {
        return res.status(403).json({
            erreur: 'La suppression de compte est réservée aux administrateurs.'
        });
    }

    const resultat = userService.modifierStatut(
        db,
        idUser,
        statut,
        req.user.idUser,
        operateurRole
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

function modifierRoleUtilisateur(req, res) {
    const idUser = Number(req.params.idUser);
    const { role } = req.body;
    const operateur = req.user;

    const rolesValides = ['user', 'moderator', 'admin'];
    if (!rolesValides.includes(role)) {
        return res.status(400).json({ erreur: 'Rôle demandé invalide.' });
    }

    if (!Number.isInteger(idUser) || idUser <= 0) {
        return res.status(400).json({ erreur: 'Identifiant utilisateur invalide.' });
    }

    // Interdiction formelle de modifier son propre rôle
    if (Number(operateur.idUser) === idUser) {
        return res.status(403).json({ erreur: 'Vous ne pouvez pas modifier votre propre rôle.' });
    }

    const cible = userModel.findById(idUser);
    if (!cible) {
        return res.status(404).json({ erreur: 'Utilisateur introuvable.' });
    }

    const isSuperAdmin = operateur.idUser === -999 || operateur.role === 'superadmin';

    // Règle stricte : seul le superadmin virtuel peut nommer ou modifier un admin
    if (!isSuperAdmin) {
        if (role === 'admin' || cible.role === 'admin') {
            return res.status(403).json({
                erreur: 'Seul le superadmin peut nommer ou modifier le rôle d’un administrateur.'
            });
        }
    }

    userModel.updateRole(idUser, role, db);

    return res.status(200).json({
        message: `Rôle mis à jour avec succès : l'utilisateur est maintenant ${role}.`
    });
}

function supprimerUtilisateurDefinitif(req, res) {
    const idUser = Number(req.params.idUser);
    const operateur = req.user;

    if (!Number.isInteger(idUser) || idUser <= 0) {
        return res.status(400).json({ erreur: 'Identifiant utilisateur invalide.' });
    }

    if (Number(operateur.idUser) === idUser) {
        return res.status(403).json({ erreur: 'Impossible de supprimer votre propre compte.' });
    }

    try {
        const cible = userModel.findById(idUser);
        if (!cible) {
            return res.status(404).json({ erreur: 'Utilisateur introuvable en base.' });
        }

        const isSuperAdmin = operateur.idUser === -999 || operateur.role === 'superadmin';

        if (!isSuperAdmin && cible.role === 'admin') {
            return res.status(403).json({
                erreur: 'Seul le superadmin peut supprimer définitivement un compte administrateur.'
            });
        }

        const resultat = userService.supprimerDefinitivement(db, idUser, operateur.idUser);
        if (!resultat.succes) {
            return res.status(400).json({ erreur: resultat.erreur });
        }

        return res.status(200).json({
            message: 'Compte et données associées supprimés définitivement de la base.'
        });
    } catch (error) {
        console.error('Erreur supprimerUtilisateurDefinitif :', error);
        return res.status(500).json({ erreur: 'Impossible de supprimer l’utilisateur de la base.' });
    }
}

module.exports = {
    obtenirUtilisateurs,
    modifierStatutUtilisateur,
    modifierRoleUtilisateur,
    supprimerUtilisateurDefinitif
};