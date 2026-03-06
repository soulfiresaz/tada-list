var Notes = {
    crosshairMode: false,
    defaultWidth: 200,
    defaultHeight: 180,
    defaultColor: '#FFEB3B',
    noteCount: 0,
    editingNote: null,
    actionBar: null,

    init: function() {
        this.setupDoubleClickCreate();
        this.setupFloatingButton();
        this.setupEscapeCancel();
        this.setupSelectionHandlers();
        this.createActionBar();
        this.setupDeleteKey();
        console.log('Notes module initialized');
    },

    setupDoubleClickCreate: function() {
        var self = this;
        var lastTapTime = 0;

        Board.canvas.on('mouse:dblclick', function(opt) {
            if (opt.target) return;
            if (self.crosshairMode) return;
            var pointer = Board.canvas.getPointer(opt.e);
            self.createNoteAt(pointer.x, pointer.y);
        });

        Board.canvas.on('mouse:up', function(opt) {
            if (opt.target) return;
            if (self.crosshairMode) return;
            if (Board.isPanning) return;
            if (!opt.e.touches && opt.e.pointerType !== 'touch') return;
            var now = Date.now();
            if (now - lastTapTime < 400) {
                var pointer = Board.canvas.getPointer(opt.e);
                self.createNoteAt(pointer.x, pointer.y);
                lastTapTime = 0;
            } else {
                lastTapTime = now;
            }
        });
    },

    setupFloatingButton: function() {
        var self = this;
        document.getElementById('add-note-btn').addEventListener('click', function() {
            if (self.crosshairMode) {
                self.exitCrosshairMode();
            } else {
                self.enterCrosshairMode();
            }
        });
    },

    setupEscapeCancel: function() {
        var self = this;
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                if (self.crosshairMode) {
                    self.exitCrosshairMode();
                } else if (self.editingNote) {
                    self.discardEdit();
                }
            }
        });
    },

    setupDeleteKey: function() {
        var self = this;
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                var active = Board.canvas.getActiveObject();
                if (!active) return;
                if (active.customType === 'divider') {
                    e.preventDefault();
                    App.showToast('The divider line cannot be deleted.');
                    return;
                }
                if (active.customType === 'note' && !active.isEditing) {
                    e.preventDefault();
                    self.deleteNote(active);
                }
            }
        });
    },

    createActionBar: function() {
        var bar = document.createElement('div');
        bar.id = 'note-action-bar';
        bar.style.cssText = 'display:none;position:fixed;z-index:95;background:#1F2A48;border:1px solid #2A2A4A;border-radius:12px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,0.4);';

        var actions = [
            { icon: '🗑️', title: 'Delete', action: 'delete' },
            { icon: '📋', title: 'Duplicate', action: 'duplicate' },
            { icon: '📦', title: 'Archive', action: 'archive' },
            { icon: '✏️', title: 'Edit', action: 'edit' }
        ];

        for (var i = 0; i < actions.length; i++) {
            var btn = document.createElement('button');
            btn.textContent = actions[i].icon;
            btn.title = actions[i].title;
            btn.setAttribute('data-action', actions[i].action);
            btn.style.cssText = 'width:40px;height:40px;border:none;background:none;font-size:1.2rem;cursor:pointer;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;';
            btn.addEventListener('click', this.handleActionClick.bind(this));
            btn.addEventListener('mouseover', function() { this.style.background = '#263354'; });
            btn.addEventListener('mouseout', function() { this.style.background = 'none'; });
            bar.appendChild(btn);
        }

        document.body.appendChild(bar);
        this.actionBar = bar;
    },

    handleActionClick: function(e) {
        var action = e.currentTarget.getAttribute('data-action');
        var active = Board.canvas.getActiveObject();
        if (!active || active.customType !== 'note') return;

        switch (action) {
            case 'delete':
                this.deleteNote(active);
                break;
            case 'duplicate':
                this.duplicateNote(active);
                break;
            case 'archive':
                this.archiveNote(active);
                break;
            case 'edit':
                this.enterEditMode(active);
                break;
        }
    },

    setupSelectionHandlers: function() {
        var self = this;

        Board.canvas.on('selection:created', function(opt) {
            var target = opt.selected ? opt.selected[0] : null;
            if (target && target.customType === 'note') {
                self.showActionBar(target);
            } else {
                self.hideActionBar();
            }
        });

        Board.canvas.on('selection:updated', function(opt) {
            var target = opt.selected ? opt.selected[0] : null;
            if (target && target.customType === 'note') {
                self.showActionBar(target);
            } else {
                self.hideActionBar();
            }
        });

        Board.canvas.on('selection:cleared', function() {
            self.hideActionBar();
        });

        Board.canvas.on('object:moving', function(opt) {
            if (opt.target && opt.target.customType === 'note') {
                self.updateActionBarPosition(opt.target);
            }
        });

        Board.canvas.on('object:scaling', function(opt) {
            if (opt.target && opt.target.customType === 'note') {
                self.updateActionBarPosition(opt.target);
            }
        });
    },

    showActionBar: function(target) {
        this.actionBar.style.display = 'flex';
        this.updateActionBarPosition(target);
    },

    hideActionBar: function() {
        this.actionBar.style.display = 'none';
    },

    updateActionBarPosition: function(target) {
        var zoom = Board.canvas.getZoom();
        var vpt = Board.canvas.viewportTransform;
        var bound = target.getBoundingRect();

        var left = bound.left + bound.width / 2 - 90;
        var top = bound.top + bound.height + 10;

        var canvasEl = Board.canvas.upperCanvasEl;
        var rect = canvasEl.getBoundingClientRect();

        left = left + rect.left;
        top = top + rect.top;

        if (left < 10) left = 10;
        if (left + 180 > window.innerWidth) left = window.innerWidth - 190;
        if (top + 50 > window.innerHeight) top = bound.top + rect.top - 50;

        this.actionBar.style.left = left + 'px';
        this.actionBar.style.top = top + 'px';
    },

    enterCrosshairMode: function() {
        var self = this;
        this.crosshairMode = true;

        var container = document.getElementById('canvas-container');
        container.style.cursor = 'crosshair';

        var btn = document.getElementById('add-note-btn');
        btn.style.background = '#FF4757';
        btn.title = 'Cancel (or press Escape)';

        App.showToast('Click anywhere on the board to place a note. Press Escape to cancel.', { duration: 3000 });

        this._crosshairHandler = function(opt) {
            if (opt.target) return;
            var pointer = Board.canvas.getPointer(opt.e);
            self.createNoteAt(pointer.x, pointer.y);
            self.exitCrosshairMode();
        };

        Board.canvas.on('mouse:down', this._crosshairHandler);
    },

    exitCrosshairMode: function() {
        this.crosshairMode = false;

        var container = document.getElementById('canvas-container');
        container.style.cursor = 'default';

        var btn = document.getElementById('add-note-btn');
        btn.style.background = '';
        btn.title = 'Add a sticky note';

        if (this._crosshairHandler) {
            Board.canvas.off('mouse:down', this._crosshairHandler);
            this._crosshairHandler = null;
        }

        App.hideToast();
    },

    createNoteAt: function(x, y) {
        this.noteCount++;
        var noteId = 'note-' + Date.now() + '-' + this.noteCount;

        var noteGroup = this.buildNote({
            id: noteId,
            x: x - this.defaultWidth / 2,
            y: y - this.defaultHeight / 2,
            width: this.defaultWidth,
            height: this.defaultHeight,
            color: this.defaultColor,
            text: '',
            shape: 'rectangle',
            fontSize: 16,
            fontFamily: 'Nunito',
            fontColor: '#000000',
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
            opacity: 1
        });

        Board.canvas.add(noteGroup);
        Board.canvas.setActiveObject(noteGroup);
        Board.canvas.renderAll();

        return noteGroup;
    },

    buildNote: function(options) {
        var bg;

        switch (options.shape) {
            case 'rounded_rectangle':
                bg = new fabric.Rect({
                    width: options.width,
                    height: options.height,
                    fill: options.color,
                    rx: 16,
                    ry: 16,
                    stroke: 'rgba(0,0,0,0.1)',
                    strokeWidth: 1,
                    originX: 'center',
                    originY: 'center'
                });
                break;
            case 'circle':
                bg = new fabric.Circle({
                    radius: Math.min(options.width, options.height) / 2,
                    fill: options.color,
                    stroke: 'rgba(0,0,0,0.1)',
                    strokeWidth: 1,
                    originX: 'center',
                    originY: 'center'
                });
                break;
            case 'star':
                bg = this.createStar(options.width / 2, options.color);
                break;
            case 'banner':
                bg = new fabric.Rect({
                    width: options.width,
                    height: options.height * 0.6,
                    fill: options.color,
                    stroke: 'rgba(0,0,0,0.1)',
                    strokeWidth: 1,
                    originX: 'center',
                    originY: 'center'
                });
                break;
            default:
                bg = new fabric.Rect({
                    width: options.width,
                    height: options.height,
                    fill: options.color,
                    stroke: 'rgba(0,0,0,0.1)',
                    strokeWidth: 1,
                    originX: 'center',
                    originY: 'center'
                });
                break;
        }

        var textObj = new fabric.Textbox(options.text, {
            width: options.width - 20,
            fontSize: options.fontSize,
            fontFamily: options.fontFamily,
            fill: options.fontColor,
            fontWeight: options.bold ? 'bold' : 'normal',
            fontStyle: options.italic ? 'italic' : 'normal',
            underline: options.underline,
            linethrough: options.strikethrough,
            textAlign: 'left',
            originX: 'center',
            originY: 'center',
            editable: false
        });

        var shadow = new fabric.Shadow({
            color: 'rgba(0,0,0,0.25)',
            blur: 8,
            offsetX: 3,
            offsetY: 3
        });

        var group = new fabric.Group([bg, textObj], {
            left: options.x,
            top: options.y,
            shadow: shadow,
            customType: 'note',
            customId: options.id,
            noteData: {
                text: options.text,
                color: options.color,
                shape: options.shape,
                fontSize: options.fontSize,
                fontFamily: options.fontFamily,
                fontColor: options.fontColor,
                bold: options.bold,
                italic: options.italic,
                underline: options.underline,
                strikethrough: options.strikethrough,
                scaleLock: true,
                archived: false,
                createdAt: new Date().toISOString()
            },
            hasControls: true,
            hasBorders: true,
            lockUniScaling: true,
            subTargetCheck: false
        });

        group.setControlsVisibility({
            mtr: true,
            mt: true,
            mb: true,
            ml: true,
            mr: true,
            tl: true,
            tr: true,
            bl: true,
            br: true
        });

        return group;
    },

    createStar: function(radius, color) {
        var points = [];
        var outerR = radius;
        var innerR = radius * 0.4;

        for (var i = 0; i < 10; i++) {
            var r = i % 2 === 0 ? outerR : innerR;
            var angle = (Math.PI / 2) + (Math.PI * 2 * i / 10);
            points.push({
                x: r * Math.cos(angle),
                y: -r * Math.sin(angle)
            });
        }

        return new fabric.Polygon(points, {
            fill: color,
            stroke: 'rgba(0,0,0,0.1)',
            strokeWidth: 1,
            originX: 'center',
            originY: 'center'
        });
    },

    enterEditMode: function(noteGroup) {
        if (!noteGroup || noteGroup.customType !== 'note') return;

        this.editingNote = noteGroup;
        this.editingNote._savedData = JSON.parse(JSON.stringify(noteGroup.noteData));
        this.hideActionBar();

        var overlay = document.getElementById('edit-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'edit-overlay';
            overlay.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:150;pointer-events:none;';
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'block';

        noteGroup.set({
            shadow: new fabric.Shadow({
                color: 'rgba(255,215,0,0.6)',
                blur: 20,
                offsetX: 0,
                offsetY: 0
            })
        });

        var toolbar = document.getElementById('edit-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.id = 'edit-toolbar';
            toolbar.style.cssText = 'display:none;position:fixed;left:0;right:0;z-index:200;background:#162447;border:1px solid #2A2A4A;padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:space-between;box-shadow:0 4px 16px rgba(0,0,0,0.4);';

            if (window.innerWidth <= 480) {
                toolbar.style.bottom = '0';
                toolbar.style.borderRadius = '16px 16px 0 0';
            } else {
                toolbar.style.top = '52px';
            }

            var discardBtn = document.createElement('button');
            discardBtn.textContent = '↩ Discard';
            discardBtn.style.cssText = 'padding:8px 14px;background:#FF4757;color:white;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:Nunito,sans-serif;';
            discardBtn.addEventListener('click', function() { Notes.discardEdit(); });

            var textInput = document.createElement('textarea');
            textInput.id = 'edit-text-input';
            textInput.placeholder = 'Type your note here...';
            textInput.style.cssText = 'flex:1;min-width:150px;padding:8px 12px;background:#1F2A48;border:1px solid #3A3A5A;border-radius:8px;color:#E8E8F0;font-size:0.95rem;font-family:Nunito,sans-serif;resize:none;height:36px;outline:none;';

            var saveBtn = document.createElement('button');
            saveBtn.textContent = '💾 Save';
            saveBtn.style.cssText = 'padding:8px 14px;background:#FFD700;color:#1B1B2F;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;';
            saveBtn.addEventListener('click', function() { Notes.saveEdit(); });

            toolbar.appendChild(discardBtn);
            toolbar.appendChild(textInput);
            toolbar.appendChild(saveBtn);
            document.body.appendChild(toolbar);
        }

        toolbar.style.display = 'flex';

        var textInput = document.getElementById('edit-text-input');
        textInput.value = noteGroup.noteData.text;
        textInput.focus();

        Board.canvas.renderAll();
    },

    saveEdit: function() {
        if (!this.editingNote) return;

        var textInput = document.getElementById('edit-text-input');
        var newText = textInput.value;

        this.editingNote.noteData.text = newText;

        var objects = this.editingNote.getObjects();
        for (var i = 0; i < objects.length; i++) {
            if (objects[i].type === 'textbox') {
                objects[i].set('text', newText);
                break;
            }
        }

        this.exitEditMode();
        App.showToast('Note saved!', { duration: 1500 });
    },

    discardEdit: function() {
        if (!this.editingNote) return;

        if (this.editingNote._savedData) {
            this.editingNote.noteData = this.editingNote._savedData;
            var objects = this.editingNote.getObjects();
            for (var i = 0; i < objects.length; i++) {
                if (objects[i].type === 'textbox') {
                    objects[i].set('text', this.editingNote._savedData.text);
                    break;
                }
            }
        }

        this.exitEditMode();
        App.showToast('Changes discarded', { duration: 1500 });
    },

    exitEditMode: function() {
        if (!this.editingNote) return;

        this.editingNote.set({
            shadow: new fabric.Shadow({
                color: 'rgba(0,0,0,0.25)',
                blur: 8,
                offsetX: 3,
                offsetY: 3
            })
        });

        delete this.editingNote._savedData;
        this.editingNote = null;

        var overlay = document.getElementById('edit-overlay');
        if (overlay) overlay.style.display = 'none';

        var toolbar = document.getElementById('edit-toolbar');
        if (toolbar) toolbar.style.display = 'none';

        Board.canvas.renderAll();
    },

    deleteNote: function(noteGroup) {
        if (!noteGroup || noteGroup.customType !== 'note') return;

        this.hideActionBar();
        Board.canvas.remove(noteGroup);
        Board.canvas.discardActiveObject();
        Board.canvas.renderAll();

        App.showToast('Note deleted', {
            duration: 5000,
            onUndo: function() {
                Board.canvas.add(noteGroup);
                Board.canvas.renderAll();
            }
        });
    },

    duplicateNote: function(noteGroup) {
        if (!noteGroup || noteGroup.customType !== 'note') return;

        var data = noteGroup.noteData;
        var newNote = this.buildNote({
            id: 'note-' + Date.now() + '-' + (++this.noteCount),
            x: noteGroup.left + 20,
            y: noteGroup.top + 20,
            width: noteGroup.width * noteGroup.scaleX,
            height: noteGroup.height * noteGroup.scaleY,
            color: data.color,
            text: data.text,
            shape: data.shape,
            fontSize: data.fontSize,
            fontFamily: data.fontFamily,
            fontColor: data.fontColor,
            bold: data.bold,
            italic: data.italic,
            underline: data.underline,
            strikethrough: data.strikethrough,
            opacity: noteGroup.opacity
        });

        Board.canvas.add(newNote);
        Board.canvas.setActiveObject(newNote);
        Board.canvas.renderAll();

        App.showToast('Note duplicated', { duration: 1500 });
    },

    archiveNote: function(noteGroup) {
        if (!noteGroup || noteGroup.customType !== 'note') return;

        noteGroup.noteData.archived = true;
        noteGroup.noteData.archivedAt = new Date().toISOString();

        this.hideActionBar();
        Board.canvas.remove(noteGroup);
        Board.canvas.discardActiveObject();
        Board.canvas.renderAll();

        App.showToast('Note archived', { duration: 2000 });
    }
};
