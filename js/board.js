var Board = {
    canvas: null,
    zoomLevel: 1,
    minZoom: 0.25,
    maxZoom: 4,
    zoomStep: 0.1,
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,

    init: function() {
        var container = document.getElementById('canvas-container');
        var width = container.offsetWidth;
        var height = container.offsetHeight;

        this.canvas = new fabric.Canvas('board-canvas', {
            width: width,
            height: height,
            backgroundColor: '#2a2a4a',
            selection: true,
            preserveObjectStacking: true
        });

        this.setupZoomControls();
        this.setupScrollZoom();
        this.setupPanning();
        this.setupPinchZoom();
        this.setupResize();
        this.updateZoomDisplay();
        this.placeDefaultElements();

        console.log('Board initialized: ' + width + 'x' + height);
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
                strokeDashArray: [8, 4],
                selectable: true,
                hasControls: true,
                hasBorders: true,
                lockScalingX: false,
                lockScalingY: false,
                customType: 'divider',
                customId: 'divider-line'
            }
        );

        dividerLine.setControlsVisibility({
            mt: false,
            mb: false,
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

            var deltaX = currentX - self.lastPanX;
            var deltaY = currentY - self.lastPanY;

            self.canvas.relativePan(new fabric.Point(deltaX, deltaY));

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

        var canvasEl = this.canvas.upperCanvasEl;

        canvasEl.addEventListener('touchstart', function(e) {
            if (e.touches.length === 2) {
                e.preventDefault();
                var dx = e.touches[0].clientX - e.touches[1].clientX;
                var dy = e.touches[0].clientY - e.touches[1].clientY;
                lastDist = Math.sqrt(dx * dx + dy * dy);
            }
        }, { passive: false });

        canvasEl.addEventListener('touchmove', function(e) {
            if (e.touches.length === 2) {
                e.preventDefault();
                var dx = e.touches[0].clientX - e.touches[1].clientX;
                var dy = e.touches[0].clientY - e.touches[1].clientY;
                var dist = Math.sqrt(dx * dx + dy * dy);

                if (lastDist > 0) {
                    var scale = dist / lastDist;
                    var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                    var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                    var rect = canvasEl.getBoundingClientRect();
                    var point = new fabric.Point(midX - rect.left, midY - rect.top);

                    self.zoomToPoint(self.zoomLevel * scale, point);
                }

                lastDist = dist;
            }
        }, { passive: false });

        canvasEl.addEventListener('touchend', function() {
            lastDist = 0;
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
        var center = new fabric.Point(
            this.canvas.getWidth() / 2,
            this.canvas.getHeight() / 2
        );
        this.zoomToPoint(newZoom, center);
    },

    zoomToPoint: function(newZoom, point) {
        if (newZoom < this.minZoom) newZoom = this.minZoom;
        if (newZoom > this.maxZoom) newZoom = this.maxZoom;

        this.zoomLevel = newZoom;
        this.canvas.zoomToPoint(point, newZoom);
        this.updateZoomDisplay();
    },

    updateZoomDisplay: function() {
        var pct = Math.round(this.zoomLevel * 100);
        document.getElementById('zoom-level').textContent = pct + '%';
    }
};
