const form =
  document.getElementById('postForm');

const submitButton =
  document.getElementById('submitButton');

const message =
  document.getElementById('message');

const progressContainer =
  document.getElementById('progressContainer');

const progressBar =
  document.getElementById('progressBar');

const progressText =
  document.getElementById('progressText');


function showMessage(
  text,
  type
) {
  message.textContent = text;

  message.className = type;

  message.style.display = 'block';
}


function hideMessage() {
  message.textContent = '';

  message.className = '';

  message.style.display = 'none';
}


form.addEventListener(
  'submit',
  async (event) => {
    event.preventDefault();

    hideMessage();

    /*
     * Le token est celui obtenu lors de la connexion.
     */
    const token =
      localStorage.getItem('token');

    if (!token) {
      showMessage(
        'Vous devez être connecté pour publier.',
        'error'
      );

      return;
    }


    const videoInput =
      document.getElementById('video');

    const contenuInput =
      document.getElementById('contenuPub');


    /*
     * Vérification frontend complémentaire.
     *
     * La validation serveur reste obligatoire.
     */

    if (
      videoInput.files.length > 0
    ) {
      const video =
        videoInput.files[0];

      const maxSize =
        50 * 1024 * 1024;

      if (video.size > maxSize) {
        showMessage(
          'La vidéo ne peut pas dépasser 50 Mo.',
          'error'
        );

        return;
      }

      const allowedExtensions = [
        '.mp4',
        '.mov',
        '.avi',
        '.webm'
      ];

      const filename =
        video.name.toLowerCase();

      const validExtension =
        allowedExtensions.some(
          (extension) =>
            filename.endsWith(extension)
        );

      if (!validExtension) {
        showMessage(
          'Format vidéo non autorisé. Utilisez MP4, MOV, AVI ou WebM.',
          'error'
        );

        return;
      }
    }


    /*
     * Une publication doit avoir au minimum du texte
     * ou une vidéo.
     */

    const hasText =
      contenuInput.value.trim().length > 0;

    const hasVideo =
      videoInput.files.length > 0;

    if (!hasText && !hasVideo) {
      showMessage(
        'Ajoutez du texte ou une vidéo.',
        'error'
      );

      return;
    }


    /*
     * FormData :
     *
     * contenuPub
     * video
     *
     * Aucun idPubli.
     * Aucun idUser.
     */

    const formData =
      new FormData();

    formData.append(
      'contenuPub',
      contenuInput.value
    );

    if (hasVideo) {
      formData.append(
        'video',
        videoInput.files[0]
      );
    }


    submitButton.disabled = true;

    progressContainer.style.display =
      'block';

    progressBar.value = 0;

    progressText.textContent =
      'Envoi : 0 %';


    try {
      /*
       * XMLHttpRequest permet d'afficher
       * la progression de l'upload.
       */
      const result =
        await uploadPublication(
          formData,
          token
        );


      /*
       * Succès.
       */

      showMessage(
        result.message ||
          'Publication créée avec succès.',
        'success'
      );

      form.reset();

      progressBar.value = 100;

      progressText.textContent =
        'Envoi : 100 %';

    } catch (error) {

      showMessage(
        error.message ||
          'Une erreur est survenue.',
        'error'
      );

    } finally {

      submitButton.disabled = false;

      setTimeout(() => {
        progressContainer.style.display =
          'none';
      }, 1500);
    }
  }
);


function uploadPublication(
  formData,
  token
) {
  return new Promise(
    (resolve, reject) => {

      const xhr =
        new XMLHttpRequest();


      xhr.open(
        'POST',
        '/post',
        true
      );


      /*
       * JWT.
       */
      xhr.setRequestHeader(
        'Authorization',
        `Bearer ${token}`
      );


      /*
       * Progression de l'envoi.
       */
      xhr.upload.addEventListener(
        'progress',
        (event) => {

          if (!event.lengthComputable) {
            return;
          }

          const percentage =
            Math.round(
              (event.loaded /
                event.total) *
                100
            );

          progressBar.value =
            percentage;

          progressText.textContent =
            `Envoi : ${percentage} %`;
        }
      );


      /*
       * Réponse HTTP.
       */
      xhr.addEventListener(
        'load',
        () => {

          let data;

          try {
            data =
              JSON.parse(
                xhr.responseText
              );
          } catch (error) {
            reject(
              new Error(
                'Réponse invalide du serveur.'
              )
            );

            return;
          }


          if (
            xhr.status >= 200 &&
            xhr.status < 300
          ) {
            resolve(data);

            return;
          }


          reject(
            new Error(
              data.error ||
                'La publication n’a pas pu être créée.'
            )
          );
        }
      );


      /*
       * Erreur réseau.
       */
      xhr.addEventListener(
        'error',
        () => {
          reject(
            new Error(
              'Impossible de contacter le serveur.'
            )
          );
        }
      );


      /*
       * Annulation.
       */
      xhr.addEventListener(
        'abort',
        () => {
          reject(
            new Error(
              'L’envoi a été annulé.'
            )
          );
        }
      );


      xhr.send(formData);
    }
  );
}

