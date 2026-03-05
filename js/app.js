var App = {
    initialized: false,
    inputType: 'mouse',
    toastTimer: null,
    confirmCallback: null,

    init: function() {
        if (this.initialized) return;
        this.initialized = true;

        this.detectInputType();
        this.setupKeyboardShortcuts();
        this.setupTabCloseWarning();

        Board.init();
        Notes.init();

        console.log('TaDa List v1.0.0 initialized');
        console.log('Input type: ' + this.inputType);
    },

    detectInputType: function() {
        var hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        var hasMouse = window.matchMedia('(hover: hover)').matches;

        if (hasTouch && !hasMouse) {
            this.inputType = 'touch';
            document.body.classList.add('touch-device');
        } else {
            this.inputType = 'mouse';
            document.body.classList.add('mouse-device');
        }

        if (!hasTouch || hasMouse) {
            document.body.classList.add('has-keyboard');
        }

        window.addEventListener('pointerdown', function(e) {
            if (e.pointerType === 'touch') {
                App.inputType = 'touch';
                document.body.classList.add('touch-device');
                document.body.classList.remove('mouse-device');
            } else if (e.pointerType === 'mouse') {
                App.inputType = 'mouse';
                document.body.classList.add('mouse-device');
                document.body.classList.remove('touch-device');
            }
        });
    },

    setupKeyboardShortcuts: function() {
        document.addEventListener('keydown', function(e) {
            if (!document.getElementById('app-screen').classList.contains('active')) return;

            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                App.undo();
            }

            if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                App.redo();
            }

            if (e.key === 'Escape') {
                App.cancelCurrentAction();
            }
        });
    },

    undo: function() {
        console.log('Undo triggered');
    },

    redo: function() {
        console.log('Redo triggered');
    },

    cancelCurrentAction: function() {
        console.log('Escape pressed');
    },

    showToast: function(message, options) {
        options = options || {};
        var toast = document.getElementById('toast');
        var msgEl = document.getElementById('toast-message');
        var undoBtn = document.getElementById('toast-undo-btn');

        if (this.toastTimer) clearTimeout(this.toastTimer);

        msgEl.textContent = message;

        if (options.onUndo) {
            undoBtn.style.display = 'inline-block';
            this.toastUndoCallback = options.onUndo;
        } else {
            undoBtn.style.display = 'none';
            this.toastUndoCallback = null;
        }

        toast.style.display = 'flex';

        var duration = options.duration || 5000;
        this.toastTimer = setTimeout(function() {
            App.hideToast();
        }, duration);
    },

    hideToast: function() {
        document.getElementById('toast').style.display = 'none';
        this.toastUndoCallback = null;
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
            this.toastTimer = null;
        }
    },

    undoToast: function() {
        if (this.toastUndoCallback) this.toastUndoCallback();
        this.hideToast();
    },

    showConfirm: function(message, onConfirm) {
        document.getElementById('confirm-message').textContent = message;
        this.confirmCallback = onConfirm;
        document.getElementById('confirm-popup').style.display = 'flex';
    },

    okConfirm: function() {
        document.getElementById('confirm-popup').style.display = 'none';
        if (this.confirmCallback) {
            this.confirmCallback();
            this.confirmCallback = null;
        }
    },

    cancelConfirm: function() {
        document.getElementById('confirm-popup').style.display = 'none';
        this.confirmCallback = null;
    },

    setupTabCloseWarning: function() {
        window.addEventListener('beforeunload', function(e) {
            if (App.hasUnsyncedChanges()) {
                e.preventDefault();
                e.returnValue = 'You have changes that have not synced yet.';
            }
        });
    },

    hasUnsyncedChanges: function() {
        return false;
    },

    formatDate: function(dateString) {
        var date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    },

    generateFilename: function(boardName, extension) {
        var now = new Date();
        var y = now.getFullYear();
        var m = String(now.getMonth() + 1).padStart(2, '0');
        var d = String(now.getDate()).padStart(2, '0');
        var safeName = boardName.replace(/[^a-zA-Z0-9]/g, '_');
        return safeName + '_' + y + '_' + m + '_' + d + '.' + extension;
    },

    truncate: function(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
};
