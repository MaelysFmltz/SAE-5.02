const profileService = require('../services/profileService');

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
    const profile = await profileService.getPublicProfile(req.params.pseudo);
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

module.exports = {
  getMe,
  getByPseudo,
  updateMe
};