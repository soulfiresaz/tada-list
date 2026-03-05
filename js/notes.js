var Notes = {
    crosshairMode: false,
    defaultWidth: 200,
    defaultHeight: 180,
    defaultColor: '#FFEB3B',
    noteCount: 0,

    init: function() {
        this.setupDoubleClickCreate();
        this.setupFloatingButton();
        this.setupEscapeCancel();
        console.log('Notes module initialized');
    },

    setupDoubleClickCreate: function() {
        var self = this;
        var lastClickTime = 0;
        var lastClickX = 0;
        var lastClickY = 0;

        Board.canvas.on('mouse:down', function(opt) {
            if (opt.target) return;
            if (Board.isPanning) return;

            var now = Date.now();
            var evt = opt.e;
            var clientX, clientY;

            if (evt.touches && evt.touches.length === 1) {
                clientX = evt.touches[0].clientX;
                clientY = evt.touches[0].clientY;
            } else {
                clientX = evt.clientX;
                clientY = evt.clientY;
            }

            var dx = clientX - lastClickX;
            var dy = clientY - lastClickY;
            var dist = Math.sqrt(dx * dx + dy * dy);

            if (now - lastClickTime < 400 && dist < 20) {
                var pointer = Board.canvas.getPointer(evt);
                self.createNoteAt(pointer.x, pointer.y);
                lastClickTime = 0;
            } else {
                lastClickTime = now;
                lastClickX = clientX;
                lastClickY = clientY;
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
            if (e.key === 'Escape' && self.crosshairMode) {
                self.exitCrosshairMode();
            }
        });
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

        group.on('mousedblclick', function() {
            Notes.enterEditMode(group);
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
        App.showToast('Note editing coming in Phase 4 Chunk B!', { duration: 2000 });
    },

    deleteNote: function(noteGroup) {
        if (!noteGroup || noteGroup.customType !== 'note') return;

        Board.canvas.remove(noteGroup);
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
    },

    archiveNote: function(noteGroup) {
        if (!noteGroup || noteGroup.customType !== 'note') return;

        noteGroup.noteData.archived = true;
        noteGroup.noteData.archivedAt = new Date().toISOString();

        Board.canvas.remove(noteGroup);
        Board.canvas.renderAll();

        App.showToast('Note archived');
    }
};
