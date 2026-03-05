/* ============================================
   TaDa List — Main App (app.js)
   Version 1.0.0
   Handles: app initialization, input detection,
   toast notifications, confirmation popups,
   shared utilities
   ============================================ */

const App = {
    initialized: false,
    inputType: 'mouse', // 'mouse' or 'touch'
    toastTimer: null,
    confirmCallback: null,

    // ==========================================
    // INITIALIZATION
    // ==========================================
    init() {
        if (this.initialized) return;
        this.initialized = true;

        this.detectInputType();
        this.setupKeyboardShortcuts();
        this.setupTabCloseWarning();

        console.log('TaDa List v1.0.0 initialized');
        console.log('Input type:', this.inputType);
        console.log('User:', Auth.currentUser?.email);
        console.log('Role:', Auth.userProfile?.role);
    },

    // ==========================================
    // INPUT DETECTION
    // ==========================================
    detectInputType() {
        // Check for touch capability
        const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const hasMouse = window.matchMedia('(hover: hover)').matches;
        const hasKeyboard = !hasTouch || hasMouse; // If has mouse, likely has keyboard too

        if (hasTouch && !hasMouse) {
            this.inputType = 'touch';
            document.body.classList.add('touch-device');
        } else {
            this.inputType = 'mouse';
            document.body.classList.add('mouse-device');
        }

        if (hasKeyboard) {
            document.body.classList.add('has-keyboard');
        }

        // Listen for input type changes (e.g., connecting mouse to iPad)
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') {
                if (this.inputType !== 'touch') {
                    this.inputType = 'touch';
                    document.body.classList.add('touch-device');
                    document.body.classList.remove('mouse-device');
                }
            } else if (e.pointerType === 'mouse') {
                if (this.inputType !== 'mouse') {
                    this.inputType = 'mouse';
                    document.body.classList.add('mouse-device');
                    document.body.classList.remove('touch-device');
                }
            }
        });
    },

    // ==========================================
    // KEYBOARD SHORTCUTS
    // ==========================================
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only when app screen is active
            if (!document.getElementById('app-screen').classList.contains('active')) return;

            // Ctrl+Z — Undo
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }

            // Ctrl+Y or Ctrl+Shift+Z — Redo
            if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                this.redo();
            }

            // Escape — Cancel current action
            if (e.key === 'Escape') {
                this.cancelCurrentAction();
            }
        });
    },

    // ==========================================
    // UNDO / REDO (placeholder for Phase 3)
    // ==========================================
    undo() {
        // Will be implemented with Fabric.js in Phase 3
        console.log('Undo triggered');
    },

    redo() {
        // Will be implemented with Fabric.js in Phase 3
        console.log('Redo triggered');
    },

    cancelCurrentAction() {
        // Will cancel crosshair mode, close panels, etc.
        console.log('Escape pressed — cancel current action');
    },

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    showToast(message, options = {}) {
        const toast = document.getElementById('toast');
        const msgEl = document.getElementById('toast-message');
        const undoBtn = document.getElementById('toast-undo');

        // Clear any existing timer
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
        }

        msgEl.textContent = message;

        // Show undo button if callback provided
        if (options.onUndo) {
            undoBtn.style.display = 'inline-block';
            this.toastUndoCallback = options.onUndo;
        } else {
            undoBtn.style.display = 'none';
            this.toastUndoCallback = null;
        }

        toast.style.display = 'flex';

        // Auto-hide after duration (default 5 seconds)
        const duration = options.duration || 5000;
        this.toastTimer = setTimeout(() => {
            this.hideToast();
        }, duration);
    },

    hideToast() {
        const toast = document.getElementById('toast');
        toast.style.display = 'none';
        this.toastUndoCallback = null;
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
            this.toastTimer = null;
        }
    },

    undoToast() {
        if (this.toastUndoCallback) {
            this.toastUndoCallback();
        }
        this.hideToast();
    },

    // ==========================================
    // CONFIRMATION POPUP
    // ==========================================
    showConfirm(message, onConfirm) {
        const popup = document.getElementById('confirm-popup');
        const msgEl = document.getElementById('confirm-message');

        msgEl.textContent = message;
        this.confirmCallback = onConfirm;
        popup.style.display = 'flex';
    },

    okConfirm() {
        const popup = document.getElementById('confirm-popup');
        popup.style.display = 'none';

        if (this.confirmCallback) {
            this.confirmCallback();
            this.confirmCallback = null;
        }
    },

    cancelConfirm() {
        const popup = document.getElementById('confirm-popup');
        popup.style.display = 'none';
        this.confirmCallback = null;
    },

    // ==========================================
    // TAB CLOSE WARNING
    // ==========================================
    setupTabCloseWarning() {
        window.addEventListener('beforeunload', (e) => {
            // Will check for unsaved/unsynced changes
            // For now, only warn if there are queued changes
            if (this.hasUnsyncedChanges()) {
                e.preventDefault();
                e.returnValue = 'You have changes that haven\'t synced yet — are you sure you want to leave?';
            }
        });
    },

    hasUnsyncedChanges() {
        // Will be implemented in Phase 9
        return false;
    },

    // ==========================================
    // UTILITIES
    // ==========================================

    // Format a date for display
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Generate auto-filename: BoardName_YYYY_MM_DD
    generateFilename(boardName, extension) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const safeName = boardName.replace(/[^a-zA-Z0-9]/g, '_');
        return `${safeName}_${year}_${month}_${day}.${extension}`;
    },

    // Truncate text with ellipsis
    truncate(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
};


// ==========================================
// APP STARTUP
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});
