const fs = require('fs/promises');
const profileService = require('../services/profileService');
const { validateMediaFile, IMAGE_TYPES } = require('../utils/mediaValidation');
const { deleteUploadedFile } = require('../utils/uploadedFiles');

async function getMe(req, res) {
  try {
    const profile = await profileService.getMyProfile(req.user.idUser);
    return res.status(200).json(profile);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
}

async function getByPseudo(req, res) {
  try {
    const profile = await profileService.getPublicProfile(
      req.params.pseudo,
      req.user.idUser
    );
    return res.status(200).json(profile);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
}

async function updateMe(req, res) {
  try {
    const updatedProfile = await profileService.updateMyProfile(req.user.idUser, req.body);
    return res.status(200).json(updatedProfile);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function uploadAvatar(req, res) {
  let uploadedFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Aucune image envoyée.'
      });
    }

    uploadedFilePath = req.file.path;

    if (!IMAGE_TYPES.includes(req.file.mimetype)) {
      await deleteUploadedFile(req.file.filename);
      return res.status(400).json({
        error: 'La photo de profil doit être une image (JPEG, PNG ou WebP).'
      });
    }

    const buffer = await fs.readFile(uploadedFilePath);

    let typeMedia;

    try {
      ({ typeMedia } = validateMediaFile(req.file, buffer));
    } catch (validationError) {
      await deleteUploadedFile(req.file.filename);
      return res.status(400).json({ error: validationError.message });
    }

    const ancienneImage = await profileService.updateAvatar(
      req.user.idUser,
      req.file.filename,
      typeMedia
    );

    uploadedFilePath = null;

    if (ancienneImage) {
      await deleteUploadedFile(ancienneImage).catch(() => {});
    }

    return res.status(200).json({
      message: 'Photo de profil mise à jour',
      avatarUrl: `/uploads/${req.file.filename}`
    });
  } catch (err) {
    if (uploadedFilePath) {
      await deleteUploadedFile(req.file.filename).catch(() => {});
    }

    return res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getMe,
  getByPseudo,
  updateMe,
  uploadAvatar
};