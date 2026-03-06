function setupDoubleClickCreate() {
    const notesContainer = document.getElementById('notes');

    notesContainer.addEventListener('dblclick', function(event) {
        const target = event.target;

        if (target.classList.contains('note')) {
            // Existing note - Enter edit mode
            const noteId = target.getAttribute('data-note-id');
            enterEditMode(noteId);
        } else {
            // Empty space - Create new note
            createNewNote();
        }
    });
}