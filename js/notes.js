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
        this.setupScaleLockBehavior();
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
                if (active.customType === 'note' && !self.editingNote) {
                    e.preventDefault();
                    self.deleteNote(active);
                }
            }
        });
    },

    setupScaleLockBehavior: function() {
        Board.canvas.on('object:scaling', function(opt) {
            var target = opt.target;
            if (!target || target.customType !== 'note') return;
            if (!target.noteData || target.noteData.scaleLock) return;

            var objects = target.getObjects();
            for (var i = 0; i < objects.length; i++) {
                if (objects[i].type === 'textbox') {
                    objects[i].set({
                        scaleX: 1 / target.scaleX,
                        scaleY: 1 / target.scaleY
                    });
                }
            }
        });

        Board.canvas.on('object:modified', function(opt) {
            var target = opt.target;
            if (!target || target.customType !== 'note') return;
            if (!target.noteData || target.noteData.scaleLock) return;

            var newWidth = target.width * target.scaleX;
            var objects = target.getObjects();
            for (var i = 0; i < objects.length; i++) {
                if (objects[i].type === 'textbox') {
                    var textPadding = target.noteData.shape === 'circle' ? 0.7 : (target.noteData.shape === 'star' ? 0.6 : 0.9);
                    objects[i].set({
                        width: (newWidth * textPadding) - 20,
                        scaleX: 1 / target.scaleX,
                        scaleY: 1 / target.scaleY
                    });
                }
            }
            Board.canvas.renderAll();
        });
    },

    createActionBar: function() {
        var bar = document.createElement('div');
        bar.id = 'note-action-bar';
        bar.style.cssText = 'display:none;position:fixed;z-index:95;background:#1F2A48;border:1px solid #2A2A4A;border-radius:12px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,0.4);';

        var actions = [
            { icon: '🗑️', title: 'Delete', action: 'delete' },
            { icon: '🔒', title: 'Scale lock: ON', action: 'scalelock' },
            { icon: '✏️', title: 'Edit', action: 'edit' },
            { icon: '📋', title: 'Duplicate', action: 'duplicate' },
            { icon: '📦', title: 'Archive', action: 'archive' }
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
            case 'delete': this.deleteNote(active); break;
            case 'duplicate': this.duplicateNote(active); break;
            case 'archive': this.archiveNote(active); break;
            case 'edit': this.enterEditMode(active); break;
            case 'scalelock': this.toggleScaleLock(active); break;
        }
    },

    toggleScaleLock: function(noteGroup) {
        if (!noteGroup || !noteGroup.noteData) return;
        var data = noteGroup.noteData;
        data.scaleLock = !data.scaleLock;
        noteGroup.set('lockUniScaling', data.scaleLock);

        this.updateScaleLockIcon(data.scaleLock);
        App.showToast(data.scaleLock ? 'Scale lock ON - text scales with note' : 'Scale lock OFF - text stays same size', { duration: 1500 });
    },

    updateScaleLockIcon: function(locked) {
        var buttons = this.actionBar.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
            if (buttons[i].getAttribute('data-action') === 'scalelock') {
                buttons[i].textContent = locked ? '🔒' : '🔓';
                buttons[i].title = locked ? 'Scale lock: ON' : 'Scale lock: OFF';
                break;
            }
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
        if (this.editingNote) return;
        if (target.noteData) {
            this.updateScaleLockIcon(target.noteData.scaleLock);
        }
        this.actionBar.style.display = 'flex';
        this.updateActionBarPosition(target);
    },

    hideActionBar: function() {
        this.actionBar.style.display = 'none';
    },

    updateActionBarPosition: function(target) {
        var bound = target.getBoundingRect();
        var canvasEl = Board.canvas.upperCanvasEl;
        var rect = canvasEl.getBoundingClientRect();

        var left = bound.left + bound.width / 2 - 110 + rect.left;
        var top = bound.top + bound.height + 10 + rect.top;

        if (left < 10) left = 10;
        if (left + 220 > window.innerWidth) left = window.innerWidth - 230;
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
            textAlign: 'left',
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
            opacity: 1,
            scaleLock: true
        });

        Board.canvas.add(noteGroup);
        Board.canvas.setActiveObject(noteGroup);
        Board.canvas.renderAll();

        return noteGroup;
    },

    buildNote: function(options) {
        var bg;
        var w = options.width;
        var h = options.height;
        var bgOpacity = options.opacity !== undefined ? options.opacity : 1;

        switch (options.shape) {
            case 'rounded_rectangle':
                bg = new fabric.Rect({
                    width: w, height: h,
                    fill: options.color, rx: 16, ry: 16,
                    stroke: 'rgba(0,0,0,0.1)', strokeWidth: 1,
                    originX: 'center', originY: 'center',
                    opacity: bgOpacity
                });
                break;
            case 'circle':
                var circleRadius = Math.max(w, h) * 0.75;
                bg = new fabric.Circle({
                    radius: circleRadius,
                    fill: options.color,
                    stroke: 'rgba(0,0,0,0.1)', strokeWidth: 1,
                    originX: 'center', originY: 'center',
                    opacity: bgOpacity
                });
                break;
            case 'star':
                var starRadius = Math.max(w, h) * 0.8;
                bg = this.createStar(starRadius, options.color);
                bg.set('opacity', bgOpacity);
                break;
            case 'banner':
                bg = new fabric.Rect({
                    width: w * 1.2, height: h * 0.5,
                    fill: options.color,
                    stroke: 'rgba(0,0,0,0.1)', strokeWidth: 1,
                    originX: 'center', originY: 'center',
                    opacity: bgOpacity
                });
                break;
            default:
                bg = new fabric.Rect({
                    width: w, height: h,
                    fill: options.color,
                    stroke: 'rgba(0,0,0,0.1)', strokeWidth: 1,
                    originX: 'center', originY: 'center',
                    opacity: bgOpacity
                });
                break;
        }

        var textWidth = options.shape === 'circle' ? w * 0.7 : (options.shape === 'star' ? w * 0.6 : w - 20);

        var textObj = new fabric.Textbox(options.text, {
            width: textWidth,
            fontSize: options.fontSize,
            fontFamily: options.fontFamily,
            fill: options.fontColor,
            fontWeight: options.bold ? 'bold' : 'normal',
            fontStyle: options.italic ? 'italic' : 'normal',
            underline: options.underline,
            linethrough: options.strikethrough,
            textAlign: options.textAlign || 'left',
            originX: 'center', originY: 'center',
            editable: false
        });

        var group = new fabric.Group([bg, textObj], {
            left: options.x,
            top: options.y,
            shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.25)', blur: 8, offsetX: 3, offsetY: 3 }),
            customType: 'note',
            customId: options.id,
            noteData: {
                text: options.text,
                color: options.color,
                shape: options.shape,
                fontSize: options.fontSize,
                fontFamily: options.fontFamily,
                fontColor: options.fontColor,
                textAlign: options.textAlign || 'left',
                bold: options.bold,
                italic: options.italic,
                underline: options.underline,
                strikethrough: options.strikethrough,
                scaleLock: options.scaleLock !== undefined ? options.scaleLock : true,
                opacity: bgOpacity,
                archived: false,
                createdAt: new Date().toISOString()
            },
            hasControls: true,
            hasBorders: true,
            lockUniScaling: options.scaleLock !== undefined ? options.scaleLock : true
        });

        return group;
    },

    createStar: function(radius, color) {
        var points = [];
        for (var i = 0; i < 10; i++) {
            var r = i % 2 === 0 ? radius : radius * 0.4;
            var angle = (Math.PI / 2) + (Math.PI * 2 * i / 10);
            points.push({ x: r * Math.cos(angle), y: -r * Math.sin(angle) });
        }
        return new fabric.Polygon(points, {
            fill: color, stroke: 'rgba(0,0,0,0.1)', strokeWidth: 1,
            originX: 'center', originY: 'center'
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
            shadow: new fabric.Shadow({ color: 'rgba(255,215,0,0.6)', blur: 20, offsetX: 0, offsetY: 0 })
        });

        this.showEditToolbar();
        Board.canvas.renderAll();
    },

    showEditToolbar: function() {
        var toolbar = document.getElementById('edit-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.id = 'edit-toolbar';

            var isPhone = window.innerWidth <= 480;
            toolbar.style.cssText = 'display:none;position:fixed;left:0;right:0;z-index:200;background:#162447;border:1px solid #2A2A4A;padding:8px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
            if (isPhone) {
                toolbar.style.bottom = '0';
                toolbar.style.borderRadius = '16px 16px 0 0';
            } else {
                toolbar.style.top = '52px';
            }

            var btnStyle = 'width:32px;height:32px;border:1px solid #3A3A5A;background:#1F2A48;color:#E8E8F0;border-radius:6px;cursor:pointer;font-size:0.9rem;display:inline-flex;align-items:center;justify-content:center;';
            var selStyle = 'padding:4px;background:#1F2A48;color:#E8E8F0;border:1px solid #3A3A5A;border-radius:6px;font-size:0.8rem;font-family:Nunito,sans-serif;';
            var lblStyle = 'color:#A0A0BC;font-size:0.7rem;';

            toolbar.innerHTML = '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:space-between;width:100%;">'
                + '<button id="edit-discard" style="padding:6px 12px;background:#FF4757;color:white;border:none;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:Nunito,sans-serif;">Discard</button>'
                + '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">'
                + '<label style="' + lblStyle + '">Note:</label>'
                + '<input type="color" id="edit-note-color" value="#FFEB3B" style="width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;background:none;">'
                + '<label style="' + lblStyle + '">Text:</label>'
                + '<input type="color" id="edit-text-color" value="#000000" style="width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;background:none;">'
                + '<select id="edit-font" style="' + selStyle + '">'
                + '<option value="Nunito">Nunito</option>'
                + '<option value="Fredoka One">Fredoka One</option>'
                + '<option value="Arial">Arial</option>'
                + '<option value="Georgia">Georgia</option>'
                + '<option value="Courier New">Courier New</option>'
                + '<option value="Times New Roman">Times New Roman</option>'
                + '</select>'
                + '<select id="edit-size" style="' + selStyle + 'width:50px;">'
                + '<option value="12">12</option><option value="14">14</option>'
                + '<option value="16" selected>16</option><option value="18">18</option>'
                + '<option value="20">20</option><option value="24">24</option>'
                + '<option value="28">28</option><option value="32">32</option>'
                + '<option value="36">36</option><option value="42">42</option>'
                + '</select>'
                + '<button id="edit-bold" class="fmt-btn" data-fmt="bold" style="' + btnStyle + 'font-weight:bold;">B</button>'
                + '<button id="edit-italic" class="fmt-btn" data-fmt="italic" style="' + btnStyle + 'font-style:italic;">I</button>'
                + '<button id="edit-underline" class="fmt-btn" data-fmt="underline" style="' + btnStyle + 'text-decoration:underline;">U</button>'
                + '<button id="edit-strike" class="fmt-btn" data-fmt="strikethrough" style="' + btnStyle + 'text-decoration:line-through;">S</button>'
                + '<select id="edit-align" style="' + selStyle + '">'
                + '<option value="left">Left</option>'
                + '<option value="center">Center</option>'
                + '<option value="right">Right</option>'
                + '<option value="justify">Justify</option>'
                + '</select>'
                + '<select id="edit-shape" style="' + selStyle + '">'
                + '<option value="rectangle">Rectangle</option>'
                + '<option value="rounded_rectangle">Rounded</option>'
                + '<option value="circle">Circle</option>'
                + '<option value="star">Star</option>'
                + '<option value="banner">Banner</option>'
                + '</select>'
                + '<label style="' + lblStyle + '">BG Opacity:</label>'
                + '<input type="range" id="edit-opacity" min="0" max="100" value="100" style="width:60px;cursor:pointer;">'
                + '<span id="edit-opacity-val" style="color:#A0A0BC;font-size:0.7rem;width:28px;">100%</span>'
                + '</div>'
                + '<div style="display:flex;align-items:center;gap:4px;">'
                + '<textarea id="edit-text-input" placeholder="Type your note..." style="width:200px;height:34px;padding:6px 10px;background:#1F2A48;border:1px solid #3A3A5A;border-radius:8px;color:#E8E8F0;font-size:0.85rem;font-family:Nunito,sans-serif;resize:none;outline:none;"></textarea>'
                + '<button id="edit-save" style="padding:6px 12px;background:#FFD700;color:#1B1B2F;border:none;border-radius:8px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;">Save</button>'
                + '</div>'
                + '</div>';

            document.body.appendChild(toolbar);

            document.getElementById('edit-discard').addEventListener('click', function() { Notes.discardEdit(); });
            document.getElementById('edit-save').addEventListener('click', function() { Notes.saveEdit(); });
            document.getElementById('edit-note-color').addEventListener('input', function() { Notes.updateNoteProperty('color', this.value); });
            document.getElementById('edit-text-color').addEventListener('input', function() { Notes.updateNoteProperty('fontColor', this.value); });
            document.getElementById('edit-font').addEventListener('change', function() { Notes.updateNoteProperty('fontFamily', this.value); });
            document.getElementById('edit-size').addEventListener('change', function() { Notes.updateNoteProperty('fontSize', parseInt(this.value)); });
            document.getElementById('edit-align').addEventListener('change', function() { Notes.updateNoteProperty('textAlign', this.value); });
            document.getElementById('edit-shape').addEventListener('change', function() { Notes.changeShape(this.value); });

            document.getElementById('edit-opacity').addEventListener('input', function() {
                var val = parseInt(this.value);
                document.getElementById('edit-opacity-val').textContent = val + '%';
                if (Notes.editingNote) {
                    Notes.editingNote.noteData.opacity = val / 100;
                    var objects = Notes.editingNote.getObjects();
                    for (var i = 0; i < objects.length; i++) {
                        if (objects[i].type !== 'textbox') {
                            objects[i].set('opacity', val / 100);
                        }
                    }
                    Board.canvas.renderAll();
                }
            });

            var fmtBtns = document.querySelectorAll('.fmt-btn');
            for (var i = 0; i < fmtBtns.length; i++) {
                fmtBtns[i].addEventListener('click', function() {
                    Notes.toggleFormat(this.getAttribute('data-fmt'));
                });
            }

            document.getElementById('edit-text-input').addEventListener('input', function() {
                Notes.updateNoteProperty('text', this.value);
            });
        }

        if (this.editingNote) {
            var data = this.editingNote.noteData;
            document.getElementById('edit-note-color').value = data.color;
            document.getElementById('edit-text-color').value = data.fontColor;
            document.getElementById('edit-font').value = data.fontFamily;
            document.getElementById('edit-size').value = String(data.fontSize);
            document.getElementById('edit-align').value = data.textAlign || 'left';
            document.getElementById('edit-shape').value = data.shape;
            document.getElementById('edit-text-input').value = data.text;
            document.getElementById('edit-opacity').value = Math.round((data.opacity !== undefined ? data.opacity : 1) * 100);
            document.getElementById('edit-opacity-val').textContent = Math.round((data.opacity !== undefined ? data.opacity : 1) * 100) + '%';
            this.updateFormatButtons();
        }

        toolbar.style.display = 'block';
        document.getElementById('edit-text-input').focus();
    },

    updateFormatButtons: function() {
        if (!this.editingNote) return;
        var data = this.editingNote.noteData;
        var pairs = [
            ['edit-bold', data.bold],
            ['edit-italic', data.italic],
            ['edit-underline', data.underline],
            ['edit-strike', data.strikethrough]
        ];
        for (var i = 0; i < pairs.length; i++) {
            var el = document.getElementById(pairs[i][0]);
            el.style.background = pairs[i][1] ? '#FFD700' : '#1F2A48';
            el.style.color = pairs[i][1] ? '#1B1B2F' : '#E8E8F0';
        }
    },

    toggleFormat: function(fmt) {
        if (!this.editingNote) return;
        var data = this.editingNote.noteData;
        switch (fmt) {
            case 'bold': data.bold = !data.bold; break;
            case 'italic': data.italic = !data.italic; break;
            case 'underline': data.underline = !data.underline; break;
            case 'strikethrough': data.strikethrough = !data.strikethrough; break;
        }
        this.updateFormatButtons();
        this.applyNoteData();
    },

    updateNoteProperty: function(prop, value) {
        if (!this.editingNote) return;
        this.editingNote.noteData[prop] = value;
        this.applyNoteData();
    },

    changeShape: function(newShape) {
        if (!this.editingNote) return;
        var note = this.editingNote;
        var data = note.noteData;
        data.shape = newShape;

        var left = note.left;
        var top = note.top;
        var w = note.width * note.scaleX;
        var h = note.height * note.scaleY;

        Board.canvas.remove(note);

        var newNote = this.buildNote({
            id: note.customId,
            x: left, y: top, width: w, height: h,
            color: data.color, text: data.text, shape: newShape,
            fontSize: data.fontSize, fontFamily: data.fontFamily, fontColor: data.fontColor,
            textAlign: data.textAlign,
            bold: data.bold, italic: data.italic,
            underline: data.underline, strikethrough: data.strikethrough,
            opacity: data.opacity, scaleLock: data.scaleLock
        });

        newNote._savedData = note._savedData;
        newNote.set({
            shadow: new fabric.Shadow({ color: 'rgba(255,215,0,0.6)', blur: 20, offsetX: 0, offsetY: 0 })
        });
        Board.canvas.add(newNote);
        Board.canvas.setActiveObject(newNote);
        Board.canvas.renderAll();

        this.editingNote = newNote;
    },

    applyNoteData: function() {
        if (!this.editingNote) return;
        var data = this.editingNote.noteData;
        var objects = this.editingNote.getObjects();

        for (var i = 0; i < objects.length; i++) {
            var obj = objects[i];
            if (obj.type === 'textbox') {
                obj.set({
                    text: data.text,
                    fontFamily: data.fontFamily,
                    fontSize: data.fontSize,
                    fill: data.fontColor,
                    fontWeight: data.bold ? 'bold' : 'normal',
                    fontStyle: data.italic ? 'italic' : 'normal',
                    underline: data.underline,
                    linethrough: data.strikethrough,
                    textAlign: data.textAlign || 'left'
                });
            } else {
                obj.set({
                    fill: data.color,
                    opacity: data.opacity !== undefined ? data.opacity : 1
                });
            }
        }

        this.editingNote.set({
            shadow: new fabric.Shadow({ color: 'rgba(255,215,0,0.6)', blur: 20, offsetX: 0, offsetY: 0 })
        });

        Board.canvas.renderAll();
    },

    saveEdit: function() {
        if (!this.editingNote) return;
        delete this.editingNote._savedData;
        this.exitEditMode();
        App.showToast('Note saved!', { duration: 1500 });
    },

    discardEdit: function() {
        if (!this.editingNote) return;

        if (this.editingNote._savedData) {
            this.editingNote.noteData = JSON.parse(JSON.stringify(this.editingNote._savedData));
            this.applyNoteData();
            delete this.editingNote._savedData;
        }

        this.exitEditMode();
        App.showToast('Changes discarded', { duration: 1500 });
    },

    exitEditMode: function() {
        if (!this.editingNote) return;

        this.editingNote.set({
            shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.25)', blur: 8, offsetX: 3, offsetY: 3 })
        });

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
            x: noteGroup.left + 20, y: noteGroup.top + 20,
            width: noteGroup.width * noteGroup.scaleX,
            height: noteGroup.height * noteGroup.scaleY,
            color: data.color, text: data.text, shape: data.shape,
            fontSize: data.fontSize, fontFamily: data.fontFamily, fontColor: data.fontColor,
            textAlign: data.textAlign,
            bold: data.bold, italic: data.italic,
            underline: data.underline, strikethrough: data.strikethrough,
            opacity: data.opacity, scaleLock: data.scaleLock
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

        App.showToast('Note archived', {
            duration: 5000,
            onUndo: function() {
                noteGroup.noteData.archived = false;
                noteGroup.noteData.archivedAt = null;
                Board.canvas.add(noteGroup);
                Board.canvas.renderAll();
            }
        });
    }
};
