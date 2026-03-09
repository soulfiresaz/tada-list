var Notes = {
    crosshairMode: false,
    defaultWidth: 200,
    defaultHeight: 180,
    defaultColor: '#FFEB3B',
    noteCount: 0,
    editingNote: null,
    editingLabel: null,
    actionBar: null,
    labelActionBar: null,
    overlayTextarea: null,

    init: function() {
        this.setupDoubleClickCreate();
        this.setupFloatingButton();
        this.setupEscapeCancel();
        this.setupSelectionHandlers();
        this.createActionBar();
        this.createLabelActionBar();
        this.setupDeleteKey();
        this.setupScaleLockBehavior();
        console.log('Notes module initialized');
    },

    setupDoubleClickCreate: function() {
        var self = this;
        var lastTapTime = 0;

        Board.canvas.on('mouse:dblclick', function(opt) {
            if (self.crosshairMode) return;

            if (opt.target && opt.target.customType === 'note') {
                self.enterEditMode(opt.target);
                return;
            }

            if (opt.target) return;

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
                } else if (self.editingLabel) {
                    self.exitLabelEditMode();
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
                if (active.isEditing) return;

                if (active.customType === 'note' && !self.editingNote) {
                    e.preventDefault();
                    self.deleteNote(active);
                } else if (active.customType === 'label' || active.customType === 'divider') {
                    e.preventDefault();
                    self.deleteElement(active);
                }
            }
        });
    },

    deleteElement: function(element) {
        this.hideActionBar();
        this.hideLabelActionBar();
        Board.canvas.remove(element);
        Board.canvas.discardActiveObject();
        Board.canvas.renderAll();

        var typeName = element.customType === 'divider' ? 'Divider' : 'Label';
        App.showToast(typeName + ' deleted', {
            duration: 5000,
            onUndo: function() {
                Board.canvas.add(element);
                Board.canvas.renderAll();
            }
        });
    },

    setupScaleLockBehavior: function() {
        Board.canvas.on('object:scaling', function(opt) {
            var target = opt.target;
            if (!target || target.customType !== 'note') return;
            if (!target.noteData) return;

            if (!target.noteData.scaleLock) {
                var objects = target.getObjects();
                for (var i = 0; i < objects.length; i++) {
                    if (objects[i].type === 'textbox') {
                        objects[i].set({
                            scaleX: 1 / target.scaleX,
                            scaleY: 1 / target.scaleY
                        });
                    }
                }
            }
        });

        Board.canvas.on('object:modified', function(opt) {
            var target = opt.target;
            if (!target || target.customType !== 'note') return;
            if (!target.noteData) return;

            if (!target.noteData.scaleLock) {
                var newWidth = target.width * target.scaleX;
                var shape = target.noteData.shape;
                var textPad = shape === 'circle' ? 0.55 : (shape === 'star' ? 0.5 : 0.9);
                var newTextWidth = (newWidth * textPad) - 10;
                if (newTextWidth < 30) newTextWidth = 30;

                var objects = target.getObjects();
                for (var i = 0; i < objects.length; i++) {
                    if (objects[i].type === 'textbox') {
                        objects[i].set({
                            width: newTextWidth,
                            scaleX: 1 / target.scaleX,
                            scaleY: 1 / target.scaleY
                        });
                    }
                }
                Board.canvas.renderAll();
            }
        });
    },

    createActionBar: function() {
        var bar = document.createElement('div');
        bar.id = 'note-action-bar';
        bar.style.cssText = 'display:none;position:fixed;z-index:95;background:#1F2A48;border:1px solid #2A2A4A;border-radius:12px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,0.4);';

        var actions = [
            { icon: '\u{1F5D1}\u{FE0F}', title: 'Delete', action: 'delete' },
            { icon: '\u{1F512}', title: 'Scale lock: ON', action: 'scalelock' },
            { icon: '\u{270F}\u{FE0F}', title: 'Edit', action: 'edit' },
            { icon: '\u{1F4CB}', title: 'Duplicate', action: 'duplicate' },
            { icon: '\u{1F4E6}', title: 'Archive', action: 'archive' }
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

    createLabelActionBar: function() {
        var bar = document.createElement('div');
        bar.id = 'label-action-bar';
        bar.style.cssText = 'display:none;position:fixed;z-index:95;background:#1F2A48;border:1px solid #2A2A4A;border-radius:12px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,0.4);';

        var actions = [
            { icon: '\u{1F5D1}\u{FE0F}', title: 'Delete', action: 'label-delete' },
            { icon: '\u{270F}\u{FE0F}', title: 'Format', action: 'label-edit' },
            { icon: '\u{1F4CB}', title: 'Duplicate', action: 'label-duplicate' }
        ];

        for (var i = 0; i < actions.length; i++) {
            var btn = document.createElement('button');
            btn.textContent = actions[i].icon;
            btn.title = actions[i].title;
            btn.setAttribute('data-action', actions[i].action);
            btn.style.cssText = 'width:40px;height:40px;border:none;background:none;font-size:1.2rem;cursor:pointer;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;';
            btn.addEventListener('click', this.handleLabelActionClick.bind(this));
            btn.addEventListener('mouseover', function() { this.style.background = '#263354'; });
            btn.addEventListener('mouseout', function() { this.style.background = 'none'; });
            bar.appendChild(btn);
        }

        document.body.appendChild(bar);
        this.labelActionBar = bar;
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

    handleLabelActionClick: function(e) {
        var action = e.currentTarget.getAttribute('data-action');
        var active = Board.canvas.getActiveObject();
        if (!active) return;

        switch (action) {
            case 'label-delete': this.deleteElement(active); break;
            case 'label-duplicate': this.duplicateLabel(active); break;
            case 'label-edit': this.enterLabelEditMode(active); break;
        }
    },

    duplicateLabel: function(label) {
        var newLabel = new fabric.IText(label.text, {
            left: label.left + 20,
            top: label.top + 20,
            fontFamily: label.fontFamily,
            fontSize: label.fontSize,
            fill: label.fill,
            fontWeight: label.fontWeight,
            fontStyle: label.fontStyle,
            underline: label.underline,
            linethrough: label.linethrough,
            textAlign: label.textAlign,
            shadow: label.shadow ? new fabric.Shadow({
                color: label.shadow.color,
                blur: label.shadow.blur,
                offsetX: label.shadow.offsetX,
                offsetY: label.shadow.offsetY
            }) : null,
            editable: true,
            selectable: true,
            hasControls: true,
            hasBorders: true,
            customType: 'label',
            customId: 'label-' + Date.now()
        });

        Board.canvas.add(newLabel);
        Board.canvas.setActiveObject(newLabel);
        Board.canvas.renderAll();
        App.showToast('Label duplicated', { duration: 1500 });
    },

    toggleScaleLock: function(noteGroup) {
        if (!noteGroup || !noteGroup.noteData) return;
        var data = noteGroup.noteData;

        var currentWidth = noteGroup.width * noteGroup.scaleX;
        var currentHeight = noteGroup.height * noteGroup.scaleY;

        data.scaleLock = !data.scaleLock;

        if (data.scaleLock) {
            noteGroup.set('lockUniScaling', true);
        } else {
            noteGroup.set('lockUniScaling', false);
        }

        this.updateScaleLockIcon(data.scaleLock);
        App.showToast(data.scaleLock ? 'Scale lock ON - text scales with note' : 'Scale lock OFF - text stays same size', { duration: 1500 });
    },

    updateScaleLockIcon: function(locked) {
        var buttons = this.actionBar.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
            if (buttons[i].getAttribute('data-action') === 'scalelock') {
                buttons[i].textContent = locked ? '\u{1F512}' : '\u{1F513}';
                buttons[i].title = locked ? 'Scale lock: ON' : 'Scale lock: OFF';
                break;
            }
        }
    },

    setupSelectionHandlers: function() {
        var self = this;

        Board.canvas.on('selection:created', function(opt) {
            var target = opt.selected ? opt.selected[0] : null;
            self.handleSelection(target);
        });

        Board.canvas.on('selection:updated', function(opt) {
            var target = opt.selected ? opt.selected[0] : null;
            self.handleSelection(target);
        });

        Board.canvas.on('selection:cleared', function() {
            self.hideActionBar();
            self.hideLabelActionBar();
        });

        Board.canvas.on('object:moving', function(opt) {
            if (opt.target && opt.target.customType === 'note') {
                self.updateActionBarPosition(opt.target);
            } else if (opt.target && (opt.target.customType === 'label' || opt.target.customType === 'divider')) {
                self.updateLabelActionBarPosition(opt.target);
            }
        });

        Board.canvas.on('object:scaling', function(opt) {
            if (opt.target && opt.target.customType === 'note') {
                self.updateActionBarPosition(opt.target);
            }
        });
    },

    handleSelection: function(target) {
        if (!target) {
            this.hideActionBar();
            this.hideLabelActionBar();
            return;
        }

        if (target.customType === 'note') {
            this.hideLabelActionBar();
            this.showActionBar(target);
        } else if (target.customType === 'label' || target.customType === 'divider') {
            this.hideActionBar();
            this.showLabelActionBar(target);
        } else {
            this.hideActionBar();
            this.hideLabelActionBar();
        }
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

    showLabelActionBar: function(target) {
        if (this.editingLabel) return;
        this.labelActionBar.style.display = 'flex';
        this.updateLabelActionBarPosition(target);
    },

    hideLabelActionBar: function() {
        this.labelActionBar.style.display = 'none';
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

    updateLabelActionBarPosition: function(target) {
        var bound = target.getBoundingRect();
        var canvasEl = Board.canvas.upperCanvasEl;
        var rect = canvasEl.getBoundingClientRect();

        var left = bound.left + bound.width / 2 - 70 + rect.left;
        var top = bound.top + bound.height + 40 + rect.top;

        if (left < 10) left = 10;
        if (left + 140 > window.innerWidth) left = window.innerWidth - 150;
        if (top + 50 > window.innerHeight) top = bound.top + rect.top - 50;

        this.labelActionBar.style.left = left + 'px';
        this.labelActionBar.style.top = top + 'px';
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
        var shapeSize = Math.max(w, h) * 0.65;

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
                bg = new fabric.Circle({
                    radius: shapeSize,
                    fill: options.color,
                    stroke: 'rgba(0,0,0,0.1)', strokeWidth: 1,
                    originX: 'center', originY: 'center',
                    opacity: bgOpacity
                });
                break;
            case 'star':
                bg = this.createStar(shapeSize, options.color);
                bg.set('opacity', bgOpacity);
                break;
            case 'speech_bubble':
                bg = this.createSpeechBubble(w, h, options.color);
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

        var textWidth;
        if (options.shape === 'circle') {
            textWidth = shapeSize * 1.1;
        } else if (options.shape === 'star') {
            textWidth = shapeSize * 0.85;
        } else if (options.shape === 'speech_bubble') {
            textWidth = w - 30;
        } else {
            textWidth = w - 20;
        }

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

    createSpeechBubble: function(w, h, color) {
        var tailSize = h * 0.2;
        var bodyH = h - tailSize;
        var rx = 15;

        var path = 'M ' + rx + ' 0'
            + ' L ' + (w - rx) + ' 0'
            + ' Q ' + w + ' 0 ' + w + ' ' + rx
            + ' L ' + w + ' ' + (bodyH - rx)
            + ' Q ' + w + ' ' + bodyH + ' ' + (w - rx) + ' ' + bodyH
            + ' L ' + (w * 0.35) + ' ' + bodyH
            + ' L ' + (w * 0.15) + ' ' + h
            + ' L ' + (w * 0.25) + ' ' + bodyH
            + ' L ' + rx + ' ' + bodyH
            + ' Q 0 ' + bodyH + ' 0 ' + (bodyH - rx)
            + ' L 0 ' + rx
            + ' Q 0 0 ' + rx + ' 0'
            + ' Z';

        return new fabric.Path(path, {
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
            shadow: new fabric.Shadow({ color: 'rgba(255,215,0,0.6)', blur: 20, offsetX: 0, offsetY: 0 })
        });

        this.showOverlayTextarea(noteGroup);
        this.showEditToolbar();
        Board.canvas.renderAll();
    },

    showOverlayTextarea: function(noteGroup) {
        if (this.overlayTextarea) {
            this.overlayTextarea.remove();
        }

        var bound = noteGroup.getBoundingRect();
        var canvasEl = Board.canvas.upperCanvasEl;
        var canvasRect = canvasEl.getBoundingClientRect();

        var left = bound.left + canvasRect.left + 10;
        var top = bound.top + canvasRect.top + 10;
        var width = bound.width - 20;
        var height = bound.height - 20;

        if (width < 60) width = 60;
        if (height < 40) height = 40;

        var data = noteGroup.noteData;

        var ta = document.createElement('textarea');
        ta.id = 'overlay-textarea';
        ta.value = data.text;
        ta.style.cssText = 'position:fixed;z-index:160;border:2px solid #FFD700;border-radius:8px;padding:8px;outline:none;resize:none;overflow:auto;'
            + 'background:rgba(255,255,255,0.95);'
            + 'font-family:' + data.fontFamily + ';'
            + 'font-size:' + data.fontSize + 'px;'
            + 'color:' + data.fontColor + ';'
            + 'font-weight:' + (data.bold ? 'bold' : 'normal') + ';'
            + 'font-style:' + (data.italic ? 'italic' : 'normal') + ';'
            + 'text-align:' + (data.textAlign || 'left') + ';'
            + 'left:' + left + 'px;'
            + 'top:' + top + 'px;'
            + 'width:' + width + 'px;'
            + 'height:' + height + 'px;';

        if (data.underline) ta.style.textDecoration = 'underline';
        if (data.strikethrough) ta.style.textDecoration = (data.underline ? 'underline ' : '') + 'line-through';

        ta.addEventListener('input', function() {
            Notes.editingNote.noteData.text = ta.value;
            Notes.applyNoteData();
        });

        document.body.appendChild(ta);
        this.overlayTextarea = ta;
        ta.focus();
    },

    updateOverlayTextareaStyle: function() {
        if (!this.overlayTextarea || !this.editingNote) return;
        var data = this.editingNote.noteData;
        var ta = this.overlayTextarea;

        ta.style.fontFamily = data.fontFamily;
        ta.style.fontSize = data.fontSize + 'px';
        ta.style.color = data.fontColor;
        ta.style.fontWeight = data.bold ? 'bold' : 'normal';
        ta.style.fontStyle = data.italic ? 'italic' : 'normal';
        ta.style.textAlign = data.textAlign || 'left';

        var decoration = '';
        if (data.underline) decoration += 'underline ';
        if (data.strikethrough) decoration += 'line-through';
        ta.style.textDecoration = decoration || 'none';
    },

    removeOverlayTextarea: function() {
        if (this.overlayTextarea) {
            this.overlayTextarea.remove();
            this.overlayTextarea = null;
        }
    },

    enterLabelEditMode: function(label) {
        if (!label) return;
        this.editingLabel = label;
        this.hideLabelActionBar();
        this.showLabelEditToolbar(label);
    },

    exitLabelEditMode: function() {
        this.editingLabel = null;
        var toolbar = document.getElementById('label-edit-toolbar');
        if (toolbar) toolbar.style.display = 'none';
    },

    showLabelEditToolbar: function(label) {
        var toolbar = document.getElementById('label-edit-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.id = 'label-edit-toolbar';

            toolbar.style.cssText = 'display:none;position:fixed;left:0;right:0;z-index:200;background:#162447;border:1px solid #2A2A4A;padding:8px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
                        toolbar.style.top = '52px';

        var btnStyle = 'width:32px;height:32px;border:1px solid #3A3A5A;background:#1F2A48;color:#E8E8F0;border-radius:6px;cursor:pointer;font-size:0.9rem;display:inline-flex;align-items:center;justify-content:center;';
            var selStyle = 'padding:4px;background:#1F2A48;color:#E8E8F0;border:1px solid #3A3A5A;border-radius:6px;font-size:0.8rem;font-family:Nunito,sans-serif;';
            var lblStyle = 'color:#A0A0BC;font-size:0.7rem;';

            toolbar.innerHTML = '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:space-between;width:100%;">'
                + '<button id="label-edit-done" style="padding:6px 12px;background:#FFD700;color:#1B1B2F;border:none;border-radius:8px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;">Done</button>'
                + '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">'
                + '<label style="' + lblStyle + '">Color:</label>'
                + '<input type="color" id="label-edit-color" value="#FFD700" style="width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;background:none;">'
                                + '<select id="label-edit-font" style="' + selStyle + '">'
                + '<option value="Fredoka One" style="font-family:Fredoka One">Fredoka One</option>'
                + '<option value="Nunito" style="font-family:Nunito">Nunito</option>'
                + '<option value="Lexend" style="font-family:Lexend">Lexend</option>'
                + '<option value="Alex Brush" style="font-family:Alex Brush">Alex Brush</option>'
                + '<option value="Asset" style="font-family:Asset">Asset</option>'
                + '<option value="Cody Star" style="font-family:Cody Star">Cody Star</option>'
                + '<option value="Creepster" style="font-family:Creepster">Creepster</option>'
                + '<option value="Delius" style="font-family:Delius">Delius</option>'
                + '<option value="Emilys Candy" style="font-family:Emilys Candy">Emilys Candy</option>'
                + '<option value="Ewert" style="font-family:Ewert">Ewert</option>'
                + '<option value="Happy Monkey" style="font-family:Happy Monkey">Happy Monkey</option>'
                + '<option value="Julius Sans One" style="font-family:Julius Sans One">Julius Sans One</option>'
                + '<option value="Kalnia Glaze" style="font-family:Kalnia Glaze">Kalnia Glaze</option>'
                + '<option value="Kranky" style="font-family:Kranky">Kranky</option>'
                + '<option value="Life Savers" style="font-family:Life Savers">Life Savers</option>'
                + '<option value="Luckiest Guy" style="font-family:Luckiest Guy">Luckiest Guy</option>'
                + '<option value="Mountains of Christmas" style="font-family:Mountains of Christmas">Mountains of Christmas</option>'
                + '<option value="Mystery Quest" style="font-family:Mystery Quest">Mystery Quest</option>'
                + '<option value="Nosifer" style="font-family:Nosifer">Nosifer</option>'
                + '<option value="Oooh Baby" style="font-family:Oooh Baby">Oooh Baby</option>'
                + '<option value="Sue Ellen Francisco" style="font-family:Sue Ellen Francisco">Sue Ellen Francisco</option>'
                + '<option value="Swanky and Moo Moo" style="font-family:Swanky and Moo Moo">Swanky and Moo Moo</option>'
                + '<option value="Arial">Arial</option>'
                + '<option value="Georgia">Georgia</option>'
                + '<option value="Courier New">Courier New</option>'
                + '<option value="Times New Roman">Times New Roman</option>'
                + '</select>'
                + '<select id="label-edit-size" style="' + selStyle + 'width:50px;">'
                + '<option value="16">16</option><option value="20">20</option>'
                + '<option value="24">24</option><option value="28">28</option>'
                + '<option value="32">32</option><option value="36">36</option>'
                + '<option value="42" selected>42</option><option value="48">48</option>'
                + '<option value="56">56</option><option value="64">64</option>'
                + '</select>'
                + '<button id="label-edit-bold" class="label-fmt-btn" data-fmt="bold" style="' + btnStyle + 'font-weight:bold;">B</button>'
                + '<button id="label-edit-italic" class="label-fmt-btn" data-fmt="italic" style="' + btnStyle + 'font-style:italic;">I</button>'
                + '<button id="label-edit-underline" class="label-fmt-btn" data-fmt="underline" style="' + btnStyle + 'text-decoration:underline;">U</button>'
                + '<button id="label-edit-strike" class="label-fmt-btn" data-fmt="strikethrough" style="' + btnStyle + 'text-decoration:line-through;">S</button>'
                + '<select id="label-edit-align" style="' + selStyle + '">'
                + '<option value="left">Left</option>'
                + '<option value="center">Center</option>'
                + '<option value="right">Right</option>'
                + '</select>'
                + '</div>'
                + '</div>';


            document.body.appendChild(toolbar);

            document.getElementById('label-edit-done').addEventListener('click', function() {
                Notes.exitLabelEditMode();
            });

            document.getElementById('label-edit-color').addEventListener('input', function() {
                if (Notes.editingLabel) {
                    if (Notes.editingLabel.customType === 'divider') {
                        Notes.editingLabel.set('stroke', this.value);
                    } else {
                        Notes.editingLabel.set('fill', this.value);
                    }
                    Board.canvas.renderAll();
                }
            });

            document.getElementById('label-edit-font').addEventListener('change', function() {
                if (Notes.editingLabel) {
                    Notes.editingLabel.set('fontFamily', this.value);
                    Board.canvas.renderAll();
                }
            });

            document.getElementById('label-edit-size').addEventListener('change', function() {
                if (Notes.editingLabel) {
                    Notes.editingLabel.set('fontSize', parseInt(this.value));
                    Board.canvas.renderAll();
                }
            });

                        document.getElementById('label-edit-align').addEventListener('change', function() {
                if (Notes.editingLabel) {
                    Notes.editingLabel.set('textAlign', this.value);
                    Board.canvas.renderAll();
                }
            });


            var fmtBtns = document.querySelectorAll('.label-fmt-btn');
            for (var i = 0; i < fmtBtns.length; i++) {
                fmtBtns[i].addEventListener('click', function() {
                    if (!Notes.editingLabel) return;
                    var fmt = this.getAttribute('data-fmt');
                    var label = Notes.editingLabel;
                    switch (fmt) {
                        case 'bold':
                            label.set('fontWeight', label.fontWeight === 'bold' ? 'normal' : 'bold');
                            break;
                        case 'italic':
                            label.set('fontStyle', label.fontStyle === 'italic' ? 'normal' : 'italic');
                            break;
                        case 'underline':
                            label.set('underline', !label.underline);
                            break;
                        case 'strikethrough':
                            label.set('linethrough', !label.linethrough);
                            break;
                    }
                    Board.canvas.renderAll();
                    Notes.updateLabelFormatButtons();
                });
            }
        }

        if (label) {
            if (label.customType === 'divider') {
                document.getElementById('label-edit-color').value = label.stroke || '#6C6C8A';
            } else {
                document.getElementById('label-edit-color').value = label.fill || '#FFD700';
            }
            document.getElementById('label-edit-font').value = label.fontFamily || 'Fredoka One';
                        document.getElementById('label-edit-size').value = String(label.fontSize || 42);
            document.getElementById('label-edit-align').value = label.textAlign || 'left';
            this.updateLabelFormatButtons();
        }

        toolbar.style.display = 'block';
    },

    updateLabelFormatButtons: function() {
        if (!this.editingLabel) return;
        var label = this.editingLabel;
        var pairs = [
            ['label-edit-bold', label.fontWeight === 'bold'],
            ['label-edit-italic', label.fontStyle === 'italic'],
            ['label-edit-underline', label.underline],
            ['label-edit-strike', label.linethrough]
        ];
        for (var i = 0; i < pairs.length; i++) {
            var el = document.getElementById(pairs[i][0]);
            if (el) {
                el.style.background = pairs[i][1] ? '#FFD700' : '#1F2A48';
                el.style.color = pairs[i][1] ? '#1B1B2F' : '#E8E8F0';
            }
        }
    },

    showEditToolbar: function() {
        var toolbar = document.getElementById('edit-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.id = 'edit-toolbar';

            toolbar.style.cssText = 'display:none;position:fixed;left:0;right:0;z-index:200;background:#162447;border:1px solid #2A2A4A;padding:8px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
                        toolbar.style.top = '52px';

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
                + '<option value="Nunito" style="font-family:Nunito">Nunito</option>'
                + '<option value="Fredoka One" style="font-family:Fredoka One">Fredoka One</option>'
                + '<option value="Lexend" style="font-family:Lexend">Lexend</option>'
                + '<option value="Alex Brush" style="font-family:Alex Brush">Alex Brush</option>'
                + '<option value="Asset" style="font-family:Asset">Asset</option>'
                + '<option value="Cody Star" style="font-family:Cody Star">Cody Star</option>'
                + '<option value="Creepster" style="font-family:Creepster">Creepster</option>'
                + '<option value="Delius" style="font-family:Delius">Delius</option>'
                + '<option value="Emilys Candy" style="font-family:Emilys Candy">Emilys Candy</option>'
                + '<option value="Ewert" style="font-family:Ewert">Ewert</option>'
                + '<option value="Happy Monkey" style="font-family:Happy Monkey">Happy Monkey</option>'
                + '<option value="Julius Sans One" style="font-family:Julius Sans One">Julius Sans One</option>'
                + '<option value="Kalnia Glaze" style="font-family:Kalnia Glaze">Kalnia Glaze</option>'
                + '<option value="Kranky" style="font-family:Kranky">Kranky</option>'
                + '<option value="Life Savers" style="font-family:Life Savers">Life Savers</option>'
                + '<option value="Luckiest Guy" style="font-family:Luckiest Guy">Luckiest Guy</option>'
                + '<option value="Mountains of Christmas" style="font-family:Mountains of Christmas">Mountains of Christmas</option>'
                + '<option value="Mystery Quest" style="font-family:Mystery Quest">Mystery Quest</option>'
                + '<option value="Nosifer" style="font-family:Nosifer">Nosifer</option>'
                + '<option value="Oooh Baby" style="font-family:Oooh Baby">Oooh Baby</option>'
                + '<option value="Sue Ellen Francisco" style="font-family:Sue Ellen Francisco">Sue Ellen Francisco</option>'
                + '<option value="Swanky and Moo Moo" style="font-family:Swanky and Moo Moo">Swanky and Moo Moo</option>'
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
                + '<option value="speech_bubble">Speech Bubble</option>'
                + '<option value="banner">Banner</option>'
                + '</select>'
                + '<label style="' + lblStyle + '">BG:</label>'
                + '<input type="range" id="edit-opacity" min="0" max="100" value="100" style="width:50px;cursor:pointer;">'
                + '<span id="edit-opacity-val" style="color:#A0A0BC;font-size:0.7rem;width:28px;">100%</span>'
                + '</div>'
                + '<button id="edit-save" style="padding:6px 12px;background:#FFD700;color:#1B1B2F;border:none;border-radius:8px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;">Save</button>'
                + '</div>';

            document.body.appendChild(toolbar);

            document.getElementById('edit-discard').addEventListener('click', function() { Notes.discardEdit(); });
            document.getElementById('edit-save').addEventListener('click', function() { Notes.saveEdit(); });
            document.getElementById('edit-note-color').addEventListener('input', function() { Notes.updateNoteProperty('color', this.value); });
            document.getElementById('edit-text-color').addEventListener('input', function() {
                Notes.updateNoteProperty('fontColor', this.value);
                Notes.updateOverlayTextareaStyle();
            });
            document.getElementById('edit-font').addEventListener('change', function() {
                Notes.updateNoteProperty('fontFamily', this.value);
                Notes.updateOverlayTextareaStyle();
            });
            document.getElementById('edit-size').addEventListener('change', function() {
                Notes.updateNoteProperty('fontSize', parseInt(this.value));
                Notes.updateOverlayTextareaStyle();
            });
            document.getElementById('edit-align').addEventListener('change', function() {
                Notes.updateNoteProperty('textAlign', this.value);
                Notes.updateOverlayTextareaStyle();
            });
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

            var fmtBtns = toolbar.querySelectorAll('.fmt-btn');
            for (var i = 0; i < fmtBtns.length; i++) {
                fmtBtns[i].addEventListener('click', function() {
                    Notes.toggleFormat(this.getAttribute('data-fmt'));
                    Notes.updateOverlayTextareaStyle();
                });
            }
        }

        if (this.editingNote) {
            var data = this.editingNote.noteData;
            document.getElementById('edit-note-color').value = data.color;
            document.getElementById('edit-text-color').value = data.fontColor;
            document.getElementById('edit-font').value = data.fontFamily;
            document.getElementById('edit-size').value = String(data.fontSize);
            document.getElementById('edit-align').value = data.textAlign || 'left';
            document.getElementById('edit-shape').value = data.shape;
            document.getElementById('edit-opacity').value = Math.round((data.opacity !== undefined ? data.opacity : 1) * 100);
            document.getElementById('edit-opacity-val').textContent = Math.round((data.opacity !== undefined ? data.opacity : 1) * 100) + '%';
            this.updateFormatButtons();
        }

        toolbar.style.display = 'block';
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
        this.showOverlayTextarea(newNote);
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
        if (this.overlayTextarea) {
            this.editingNote.noteData.text = this.overlayTextarea.value;
            this.applyNoteData();
        }
        delete this.editingNote._savedData;
        this.removeOverlayTextarea();
        this.exitEditMode();
        App.showToast('Note saved!', { duration: 1500 });
    },

    discardEdit: function() {
        if (!this.editingNote) return;

        var hasChanges = false;
        if (this.editingNote._savedData) {
            var current = JSON.stringify(this.editingNote.noteData);
            var saved = JSON.stringify(this.editingNote._savedData);
            if (current !== saved) hasChanges = true;
            if (this.overlayTextarea && this.overlayTextarea.value !== this.editingNote._savedData.text) hasChanges = true;
        }

        if (hasChanges) {
            App.showConfirm('Discard all changes to this note?', function() {
                if (Notes.editingNote && Notes.editingNote._savedData) {
                    Notes.editingNote.noteData = JSON.parse(JSON.stringify(Notes.editingNote._savedData));
                    Notes.applyNoteData();
                    delete Notes.editingNote._savedData;
                }
                Notes.removeOverlayTextarea();
                Notes.exitEditMode();
                App.showToast('Changes discarded', { duration: 1500 });
            });
        } else {
            delete this.editingNote._savedData;
            this.removeOverlayTextarea();
            this.exitEditMode();
        }
    },

    exitEditMode: function() {
        if (!this.editingNote) return;

        this.editingNote.set({
            shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.25)', blur: 8, offsetX: 3, offsetY: 3 })
        });

        this.editingNote = null;
        this.removeOverlayTextarea();

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
