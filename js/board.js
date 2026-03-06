var Board = {
    canvas: null,
    zoomLevel: 1,
    minZoom: 0.25,
    maxZoom: 4,
    zoomStep: 0.1,
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,
    undoStack: [],
    redoStack: [],
    maxHistory: 20,
    trackingChanges: true,

    boards: [],
    currentBoardIndex: -1,
    boardDropdownOpen: false,
    isReady: false,

    init: function() {
        var container = document.getElementById('canvas-container');
        var width = container.offsetWidth;
        var height = container.offsetHeight;

        this.canvas = new fabric.Canvas('board-canvas', {
            width: width,
            height: height,
            backgroundColor: '#2a2a4a',
            selection: true,
            preserveObjectStacking: true,
            allowTouchScrolling: false
        });

        this.setupZoomControls();
        this.setupScrollZoom();
        this.setupPanning();
        this.setupPinchZoom();
        this.setupResize();
        this.setupUndoRedo();
        this.setupBoardDropdown();
        this.setupAddBoardButton();
        this.updateZoomDisplay();

        this.isReady = true;
        this.addNewBoard('My Board');

        console.log('Board initialized');
    },

    addNewBoard: function(name) {
        var board = {
            id: 'board-' + Date.now() + '-' + this.boards.length,
            name: name,
            objects: null,
            zoomLevel: 1,
            panX: 0,
            panY: 0
        };

        this.boards.push(board);
        var newIndex = this.boards.length - 1;

        if (this.currentBoardIndex >= 0) {
            this.saveCurrentBoardState();
        }

        this.currentBoardIndex = newIndex;
        this.canvas.clear();
        this.canvas.setBackgroundColor('#2a2a4a', function() {});
        this.zoomLevel = 1;
        this.canvas.setZoom(1);
        this.canvas.absolutePan(new fabric.Point(0, 0));
        this.placeDefaultElements();

        this.updateBoardName();
        this.updateBoardCounter();
        this.updateZoomDisplay();
        this.undoStack = [];
        this.redoStack = [];
        this.updateUndoRedoButtons();
    },

    switchToBoard: function(index) {
        if (index < 0 || index >= this.boards.length) return;
        if (index === this.currentBoardIndex) return;

        if (Notes && Notes.editingNote) {
            Notes.exitEditMode();
        }
        if (Notes) {
            Notes.hideActionBar();
        }

        this.saveCurrentBoardState();
        this.currentBoardIndex = index;
        var board = this.boards[index];

        this.canvas.clear();
        this.canvas.setBackgroundColor('#2a2a4a', function() {});

        if (board.objects && board.objects.objects && board.objects.objects.length > 0) {
            var self = this;
            this.canvas.loadFromJSON(board.objects, function() {
                self.zoomLevel = board.zoomLevel || 1;
                self.canvas.setZoom(self.zoomLevel);
                self.canvas.absolutePan(new fabric.Point(board.panX || 0, board.panY || 0));
                self.canvas.renderAll();
            });
        } else {
            this.zoomLevel = 1;
            this.canvas.setZoom(1);
            this.canvas.absolutePan(new fabric.Point(0, 0));
            this.placeDefaultElements();
        }

        this.updateBoardName();
        this.updateBoardCounter();
        this.updateZoomDisplay();
        this.undoStack = [];
        this.redoStack = [];
        this.updateUndoRedoButtons();
    },

    saveCurrentBoardState: function() {
        if (this.currentBoardIndex < 0) return;
        if (this.currentBoardIndex >= this.boards.length) return;

        var board = this.boards[this.currentBoardIndex];
        if (!board) return;

        board.objects = this.canvas.toJSON(['customType', 'customId', 'noteData', 'lockUniScaling', 'padding', 'perPixelTargetFind']);
        board.zoomLevel = this.zoomLevel;

        var vpt = this.canvas.viewportTransform;
        if (vpt) {
            board.panX = vpt[4];
            board.panY = vpt[5];
        }
    },

    placeDefaultElements: function() {
        var canvasWidth = this.canvas.getWidth();
        var canvasHeight = this.canvas.getHeight();

        var todoLabel = new fabric.IText('To Do', {
            left: canvasWidth * 0.2,
            top: 40,
            fontFamily: 'Fredoka One',
            fontSize: 42,
            fill: '#FFD700',
            shadow: '2px 2px 4px rgba(0,0,0,0.3)',
            editable: true,
            selectable: true,
            hasControls: true,
            hasBorders: true,
            customType: 'label',
            customId: 'todo-label'
        });

        var tadaLabel = new fabric.IText('Ta Da', {
            left: canvasWidth * 0.7,
            top: 40,
            fontFamily: 'Fredoka One',
            fontSize: 42,
            fill: '#2ED573',
            shadow: '2px 2px 4px rgba(0,0,0,0.3)',
            editable: true,
            selectable: true,
            hasControls: true,
            hasBorders: true,
            customType: 'label',
            customId: 'tada-label'
        });

        var dividerLine = new fabric.Line(
            [canvasWidth / 2, 20, canvasWidth / 2, canvasHeight - 20],
            {
                stroke: '#6C6C8A',
                strokeWidth: 3,
                perPixelTargetFind: false,
                padding: 15,
                strokeDashArray: [8, 4],
                selectable: true,
                hasControls: true,
                hasBorders: true,
                customType: 'divider',
                customId: 'divider-line'
            }
        );

        dividerLine.setControlsVisibility({
            mt: true,
            mb: true,
            ml: false,
            mr: false,
            bl: false,
            br: false,
            tl: false,
            tr: false,
            mtr: true
        });

        this.canvas.add(dividerLine);
        this.canvas.add(todoLabel);
        this.canvas.add(tadaLabel);
        this.canvas.renderAll();
    },

    setupBoardDropdown: function() {
        var self = this;

        var dropdown = document.createElement('div');
        dropdown.id = 'board-dropdown';
        dropdown.style.cssText = 'display:none;position:fixed;z-index:300;background:#162447;border:1px solid #2A2A4A;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-height:400px;overflow-y:auto;min-width:220px;';
        document.body.appendChild(dropdown);

        document.getElementById('board-name-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            if (self.boardDropdownOpen) {
                self.closeBoardDropdown();
            } else {
                self.openBoardDropdown();
            }
        });

        document.getElementById('board-name-btn').addEventListener('dblclick', function(e) {
            e.stopPropagation();
            e.preventDefault();
            self.closeBoardDropdown();
            self.startRenameBoard();
        });

        document.addEventListener('click', function() {
            if (self.boardDropdownOpen) {
                self.closeBoardDropdown();
            }
        });
    },

    openBoardDropdown: function() {
        var dropdown = document.getElementById('board-dropdown');
        var btn = document.getElementById('board-name-btn');
        var rect = btn.getBoundingClientRect();

        dropdown.innerHTML = '';

        for (var i = 0; i < this.boards.length; i++) {
            var item = document.createElement('button');
            item.textContent = this.boards[i].name;
            item.setAttribute('data-index', String(i));
            item.style.cssText = 'display:block;width:100%;padding:12px 16px;border:none;background:none;color:#E8E8F0;font-size:0.95rem;font-family:Nunito,sans-serif;text-align:left;cursor:pointer;';

            if (i === this.currentBoardIndex) {
                item.style.background = '#263354';
                item.style.fontWeight = '700';
                item.style.color = '#FFD700';
            }

            item.addEventListener('mouseover', function() {
                if (parseInt(this.getAttribute('data-index')) !== Board.currentBoardIndex) {
                    this.style.background = '#1F2A48';
                }
            });
            item.addEventListener('mouseout', function() {
                if (parseInt(this.getAttribute('data-index')) !== Board.currentBoardIndex) {
                    this.style.background = 'none';
                }
            });
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(this.getAttribute('data-index'));
                Board.switchToBoard(idx);
                Board.closeBoardDropdown();
            });

            dropdown.appendChild(item);
        }

        var divider = document.createElement('div');
        divider.style.cssText = 'height:1px;background:#2A2A4A;margin:4px 0;';
        dropdown.appendChild(divider);

        var addBtn = document.createElement('button');
        addBtn.textContent = '+ Add New Board';
        addBtn.style.cssText = 'display:block;width:100%;padding:12px 16px;border:none;background:none;color:#FFD700;font-size:0.95rem;font-family:Nunito,sans-serif;text-align:left;cursor:pointer;font-weight:600;';
        addBtn.addEventListener('mouseover', function() { this.style.background = '#1F2A48'; });
        addBtn.addEventListener('mouseout', function() { this.style.background = 'none'; });
        addBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            Board.closeBoardDropdown();
            Board.promptNewBoard();
        });
        dropdown.appendChild(addBtn);

        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = rect.bottom + 4 + 'px';
        dropdown.style.display = 'block';
        this.boardDropdownOpen = true;
    },

    closeBoardDropdown: function() {
        document.getElementById('board-dropdown').style.display = 'none';
        this.boardDropdownOpen = false;
    },

    setupAddBoardButton: function() {
        var self = this;
        document.getElementById('add-board-btn').addEventListener('click', function() {
            self.promptNewBoard();
        });
    },

    promptNewBoard: function() {
        var name = prompt('Enter a name for your new board:');
        if (name && name.trim()) {
            this.addNewBoard(name.trim());
            App.showToast('Board "' + name.trim() + '" created!', { duration: 1500 });
        }
    },

    startRenameBoard: function() {
        var currentName = this.boards[this.currentBoardIndex].name;
        var newName = prompt('Rename board:', currentName);
        if (newName && newName.trim() && newName.trim() !== currentName) {
            this.boards[this.currentBoardIndex].name = newName.trim();
            this.updateBoardName();
            App.showToast('Board renamed to "' + newName.trim() + '"', { duration: 1500 });
        }
    },

    updateBoardName: function() {
        if (this.currentBoardIndex < 0) return;
        var name = this.boards[this.currentBoardIndex].name;
        document.getElementById('board-name-text').textContent = name;
    },

    updateBoardCounter: function() {
        var counter = (this.currentBoardIndex + 1) + ' of ' + this.boards.length;
        document.getElementById('board-counter').textContent = counter;
    },

    setupUndoRedo: function() {
        var self = this;

        this.canvas.on('object:modified', function(opt) {
            if (!self.trackingChanges) return;
            self.saveState(opt.target, 'modified');
        });

        document.getElementById('undo-btn').addEventListener('click', function() {
            self.undo();
        });

        document.getElementById('redo-btn').addEventListener('click', function() {
            self.redo();
        });
    },

    saveState: function(target, action) {
        if (!target) return;

        var state = {
            target: target,
            action: action,
            properties: {
                left: target.left,
                top: target.top,
                scaleX: target.scaleX,
                scaleY: target.scaleY,
                angle: target.angle,
                flipX: target.flipX,
                flipY: target.flipY
            }
        };

        if (target._originalState) {
            state.previous = {
                left: target._originalState.left,
                top: target._originalState.top,
                scaleX: target._originalState.scaleX || target.scaleX,
                scaleY: target._originalState.scaleY || target.scaleY,
                angle: target._originalState.angle || target.angle,
                flipX: target._originalState.flipX !== undefined ? target._originalState.flipX : target.flipX,
                flipY: target._originalState.flipY !== undefined ? target._originalState.flipY : target.flipY
            };
            delete target._originalState;
        }

        this.undoStack.push(state);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }

        this.redoStack = [];
        this.updateUndoRedoButtons();
    },

    undo: function() {
        if (this.undoStack.length === 0) return;

        var state = this.undoStack.pop();
        var target = state.target;

        var currentProps = {
            left: target.left,
            top: target.top,
            scaleX: target.scaleX,
            scaleY: target.scaleY,
            angle: target.angle,
            flipX: target.flipX,
            flipY: target.flipY
        };

        if (state.previous) {
            this.trackingChanges = false;
            target.set(state.previous);
            target.setCoords();
            this.canvas.renderAll();
            this.trackingChanges = true;
        }

        this.redoStack.push({
            target: target,
            action: state.action,
            properties: currentProps,
            previous: state.previous
        });

        this.updateUndoRedoButtons();
    },

    redo: function() {
        if (this.redoStack.length === 0) return;

        var state = this.redoStack.pop();
        var target = state.target;

        var currentProps = {
            left: target.left,
            top: target.top,
            scaleX: target.scaleX,
            scaleY: target.scaleY,
            angle: target.angle,
            flipX: target.flipX,
            flipY: target.flipY
        };

        this.trackingChanges = false;
        target.set(state.properties);
        target.setCoords();
        this.canvas.renderAll();
        this.trackingChanges = true;

        this.undoStack.push({
            target: target,
            action: state.action,
            properties: state.properties,
            previous: currentProps
        });

        this.updateUndoRedoButtons();
    },

    updateUndoRedoButtons: function() {
        document.getElementById('undo-btn').disabled = this.undoStack.length === 0;
        document.getElementById('redo-btn').disabled = this.redoStack.length === 0;
    },

    setupZoomControls: function() {
        var self = this;

        document.getElementById('zoom-in-btn').addEventListener('click', function() {
            self.zoomTo(self.zoomLevel + self.zoomStep);
        });

        document.getElementById('zoom-out-btn').addEventListener('click', function() {
            self.zoomTo(self.zoomLevel - self.zoomStep);
        });

        document.getElementById('zoom-level').addEventListener('click', function() {
            self.zoomTo(1);
            self.canvas.absolutePan(new fabric.Point(0, 0));
        });
    },

    setupScrollZoom: function() {
        var self = this;

        this.canvas.on('mouse:wheel', function(opt) {
            var delta = opt.e.deltaY;
            var pointer = self.canvas.getPointer(opt.e, true);
            var point = new fabric.Point(pointer.x, pointer.y);

            if (delta < 0) {
                self.zoomToPoint(self.zoomLevel + self.zoomStep, point);
            } else {
                self.zoomToPoint(self.zoomLevel - self.zoomStep, point);
            }

            opt.e.preventDefault();
            opt.e.stopPropagation();
        });
    },

    setupPanning: function() {
        var self = this;

        this.canvas.on('mouse:down', function(opt) {
            if (opt.target) return;
            var evt = opt.e;
            self.isPanning = true;
            self.canvas.selection = false;
            self.canvas.discardActiveObject();
            self.canvas.requestRenderAll();

            if (evt.touches && evt.touches.length === 1) {
                self.lastPanX = evt.touches[0].clientX;
                self.lastPanY = evt.touches[0].clientY;
            } else {
                self.lastPanX = evt.clientX;
                self.lastPanY = evt.clientY;
            }
        });

        this.canvas.on('mouse:move', function(opt) {
            if (!self.isPanning) return;
            var evt = opt.e;
            var currentX, currentY;

            if (evt.touches && evt.touches.length === 1) {
                currentX = evt.touches[0].clientX;
                currentY = evt.touches[0].clientY;
            } else {
                currentX = evt.clientX;
                currentY = evt.clientY;
            }

            self.canvas.relativePan(new fabric.Point(currentX - self.lastPanX, currentY - self.lastPanY));
            self.lastPanX = currentX;
            self.lastPanY = currentY;
        });

        this.canvas.on('mouse:up', function() {
            self.isPanning = false;
            self.canvas.selection = true;
        });
    },

    setupPinchZoom: function() {
        var self = this;
        var lastDist = 0;
        var isPinching = false;

        var canvasEl = document.getElementById('canvas-container');

        canvasEl.addEventListener('touchstart', function(e) {
            if (e.touches.length === 2) {
                e.preventDefault();
                isPinching = true;
                self.isPanning = false;
                var dx = e.touches[0].clientX - e.touches[1].clientX;
                var dy = e.touches[0].clientY - e.touches[1].clientY;
                lastDist = Math.sqrt(dx * dx + dy * dy);
            }
        }, { passive: false });

        canvasEl.addEventListener('touchmove', function(e) {
            if (e.touches.length === 2 && isPinching) {
                e.preventDefault();
                var dx = e.touches[0].clientX - e.touches[1].clientX;
                var dy = e.touches[0].clientY - e.touches[1].clientY;
                var dist = Math.sqrt(dx * dx + dy * dy);

                if (lastDist > 0) {
                    var newZoom = self.zoomLevel * (dist / lastDist);
                    if (newZoom < self.minZoom) newZoom = self.minZoom;
                    if (newZoom > self.maxZoom) newZoom = self.maxZoom;

                    var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                    var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                    var canvasRect = self.canvas.upperCanvasEl.getBoundingClientRect();

                    self.zoomLevel = newZoom;
                    self.canvas.zoomToPoint(new fabric.Point(midX - canvasRect.left, midY - canvasRect.top), newZoom);
                    self.updateZoomDisplay();
                }
                lastDist = dist;
            }
        }, { passive: false });

        canvasEl.addEventListener('touchend', function(e) {
            if (e.touches.length < 2) {
                isPinching = false;
                lastDist = 0;
            }
        });
    },

    setupResize: function() {
        var self = this;
        window.addEventListener('resize', function() {
            var container = document.getElementById('canvas-container');
            self.canvas.setWidth(container.offsetWidth);
            self.canvas.setHeight(container.offsetHeight);
            self.canvas.renderAll();
        });
    },

    zoomTo: function(newZoom) {
        this.zoomToPoint(newZoom, new fabric.Point(this.canvas.getWidth() / 2, this.canvas.getHeight() / 2));
    },

    zoomToPoint: function(newZoom, point) {
        if (newZoom < this.minZoom) newZoom = this.minZoom;
        if (newZoom > this.maxZoom) newZoom = this.maxZoom;
        this.zoomLevel = newZoom;
        this.canvas.zoomToPoint(point, newZoom);
        this.updateZoomDisplay();
    },

    updateZoomDisplay: function() {
        document.getElementById('zoom-level').textContent = Math.round(this.zoomLevel * 100) + '%';
    }
};
