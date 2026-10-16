document.addEventListener('click', async (event) => {
    const button = event.target.closest('.delete-post');

    if (!button) {
        return;
    }

    const idPubli = button.dataset.id;

    if (!idPubli) {
        return;
    }

    const confirmation = confirm(
        'Voulez-vous vraiment supprimer cette publication ?'
    );

    if (!confirmation) {
        return;
    }

    try {
        const response = await fetch(`/post/api/${idPubli}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Impossible de supprimer la publication.');
            return;
        }

        // Suppression visuelle immédiate du post.
        const postElement = button.closest('.post');

        if (postElement) {
            postElement.remove();
        }

    } catch (error) {
        console.error(error);
        alert('Une erreur est survenue lors de la suppression.');
    }
});