/* ============================================
   TaDa List — Color Panel (colors.js)
   Version 1.0.0
   Shared color picker used everywhere
   ============================================ */

var ColorPanel = {
    isOpen: false,
    currentTarget: null,  /* what we're coloring: 'note', 'text', 'label', 'bg' */
    currentCallback: null, /* function to call when color is picked */
    favorites: [],
    maxFavorites: 5,
    recent: [],
    maxRecent: 3,

    presets: {
        'Reds': ['#FF4757', '#FF6B6B', '#EE5A24', '#FF6348', '#C0392B'],
        'Oranges': ['#FFA502', '#FFB347', '#FFBE76', '#F39C12', '#E67E22'],
        'Yellows': ['#FFEB3B', '#FFD700', '#FFC312', '#F6E58D', '#FFF200'],
        'Greens': ['#2ED573', '#7BED9F', '#96CEB4', '#26DE81', '#27AE60'],
        'Blues': ['#45B7D1', '#4ECDC4', '#54A0FF', '#3867D6', '#2980B9'],
        'Purples': ['#DDA0DD', '#A55EEA', '#7C4DFF', '#6C5CE7', '#8E44AD'],
        'Pinks': ['#FF6B81', '#FDA7DF', '#E84393', '#FD79A8', '#FF78CB'],
        'Neutrals': ['#FFFFFF', '#D2DAE2', '#808E9B', '#485460', '#1B1B2F']
    },

    init: function() {
        this.buildPanel();
        this.setupOverlay();
        console.log('ColorPanel initialized');
    },

    buildPanel: function() {
        /* Check if panel already exists */
        if (document.getElementById('color-panel')) return;

        /* Overlay */
        var overlay = document.createElement('div');
        overlay.id = 'color-panel-overlay';
        overlay.className = 'panel-overlay';
        document.body.appendChild(overlay);

        /* Panel */
        var panel = document.createElement('div');
        panel.id = 'color-panel';
        panel.className = 'slide-panel';

        var html = '';

        /* Header */
        html += '<div class="panel-header">';
        html += '<h2>&#127912; Pick a Color</h2>';
        html += '<button class="panel-close" id="color-panel-close">&#10005;</button>';
        html += '</div>';

        html += '<div class="panel-content">';

        /* Favorites Section */
        html += '<div class="panel-section">';
        html += '<h3 class="panel-section-title">&#11088; Favorites</h3>';
        html += '<div id="color-fav-grid" class="color-fav-grid">';
        html += '<p class="panel-empty-msg" id="color-fav-empty">Tap the pin on any color to add it here.</p>';
        html += '</div>';
        html += '</div>';

        /* Recent Section */
        html += '<div class="panel-section">';
        html += '<h3 class="panel-section-title">&#128340; Recent</h3>';
        html += '<div id="color-recent-grid" class="color-recent-grid">';
        html += '<p class="panel-empty-msg" id="color-recent-empty">Colors you use will appear here.</p>';
        html += '</div>';
        html += '</div>';

        /* Preset Families */
        html += '<div class="panel-section">';
        html += '<h3 class="panel-section-title">Color Families</h3>';
        var families = Object.keys(this.presets);
        for (var f = 0; f < families.length; f++) {
            var familyName = families[f];
            var colors = this.presets[familyName];
            html += '<div class="color-family">';
            html += '<span class="color-family-label">' + familyName + '</span>';
            html += '<div class="color-family-row">';
            for (var c = 0; c < colors.length; c++) {
                html += '<div class="color-preset-wrap">';
                html += '<button class="color-preset" data-color="' + colors[c] + '" style="background:' + colors[c] + ';'
                    + (colors[c] === '#FFFFFF' ? 'border:1px solid #3A3A5A;' : '') + '" title="' + colors[c] + '"></button>';
                html += '<button class="color-pin-btn" data-color="' + colors[c] + '" title="Pin to favorites">&#128204;</button>';
                html += '</div>';
            }
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';

        /* Custom Color Picker */
        html += '<div class="panel-section">';
        html += '<h3 class="panel-section-title">Custom Color</h3>';
        html += '<div class="color-custom-row">';
        html += '<input type="color" id="color-spectrum" value="#FFD700" class="color-spectrum-input">';
        html += '<div class="color-custom-inputs">';
        html += '<div class="color-input-group">';
        html += '<label class="color-input-label">HEX</label>';
        html += '<input type="text" id="color-hex-input" class="panel-text-input color-hex-field" value="#FFD700" maxlength="7" placeholder="#000000">';
        html += '</div>';
        html += '<div class="color-input-group">';
        html += '<label class="color-input-label">R</label>';
        html += '<input type="number" id="color-r-input" class="panel-text-input color-rgb-field" value="255" min="0" max="255">';
        html += '</div>';
        html += '<div class="color-input-group">';
        html += '<label class="color-input-label">G</label>';
        html += '<input type="number" id="color-g-input" class="panel-text-input color-rgb-field" value="215" min="0" max="255">';
        html += '</div>';
        html += '<div class="color-input-group">';
        html += '<label class="color-input-label">B</label>';
        html += '<input type="number" id="color-b-input" class="panel-text-input color-rgb-field" value="0" min="0" max="255">';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        html += '<div class="color-preview-row">';
        html += '<div id="color-preview-box" class="color-preview-box" style="background:#FFD700;"></div>';
        html += '<button id="color-apply-custom" class="btn-small">Apply This Color</button>';
        html += '</div>';
        html += '</div>';

        /* Eyedropper */
        html += '<div class="panel-section">';
        html += '<h3 class="panel-section-title">Eyedropper</h3>';
        html += '<button id="color-eyedropper-btn" class="btn-small btn-muted" style="width:100%;">&#128065; Pick color from board</button>';
        html += '<p class="panel-hint">Click anywhere on the board to grab that color.</p>';
        html += '</div>';

        /* Opacity */
        html += '<div class="panel-section">';
        html += '<h3 class="panel-section-title">Opacity</h3>';
        html += '<div class="color-opacity-row">';
        html += '<input type="range" id="color-opacity-slider" min="0" max="100" value="100" class="color-opacity-slider">';
        html += '<span id="color-opacity-val" class="color-opacity-val">100%</span>';
        html += '</div>';
        html += '</div>';

        html += '</div>'; /* end panel-content */

        panel.innerHTML = html;
        document.body.appendChild(panel);

        this.attachEvents();
    },

    attachEvents: function() {
        var self = this;

        /* Close panel */
        document.getElementById('color-panel-close').addEventListener('click', function() {
            self.close();
        });
        document.getElementById('color-panel-overlay').addEventListener('click', function() {
            self.close();
        });

        /* Preset color clicks */
        var presets = document.querySelectorAll('.color-preset');
        for (var i = 0; i < presets.length; i++) {
            presets[i].addEventListener('click', function() {
                var color = this.getAttribute('data-color');
                self.selectColor(color);
            });
        }

        /* Pin buttons */
        var pins = document.querySelectorAll('.color-pin-btn');
        for (var p = 0; p < pins.length; p++) {
            pins[p].addEventListener('click', function(e) {
                e.stopPropagation();
                var color = this.getAttribute('data-color');
                self.pinColor(color);
            });
        }

        /* Spectrum picker */
        document.getElementById('color-spectrum').addEventListener('input', function() {
            self.updateFromSpectrum(this.value);
        });

        /* Hex input */
        document.getElementById('color-hex-input').addEventListener('change', function() {
            var val = this.value.trim();
            if (val.charAt(0) !== '#') val = '#' + val;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                self.updateFromHex(val);
            }
        });

        /* RGB inputs */
        document.getElementById('color-r-input').addEventListener('change', function() { self.updateFromRGB(); });
        document.getElementById('color-g-input').addEventListener('change', function() { self.updateFromRGB(); });
        document.getElementById('color-b-input').addEventListener('change', function() { self.updateFromRGB(); });

        /* Apply custom color */
        document.getElementById('color-apply-custom').addEventListener('click', function() {
            var hex = document.getElementById('color-hex-input').value;
            self.selectColor(hex);
        });

        /* Eyedropper */
        document.getElementById('color-eyedropper-btn').addEventListener('click', function() {
            self.startEyedropper();
        });

        /* Opacity slider */
        document.getElementById('color-opacity-slider').addEventListener('input', function() {
            var val = parseInt(this.value);
            document.getElementById('color-opacity-val').textContent = val + '%';
            if (self.currentCallback) {
                self.currentCallback(null, val / 100);
            }
        });
    },

    open: function(target, callback, currentColor, currentOpacity) {
        this.currentTarget = target;
        this.currentCallback = callback;
        this.isOpen = true;

        /* Set current color in the picker */
        if (currentColor) {
            this.updateAllInputs(currentColor);
        }

        /* Set opacity */
        if (currentOpacity !== undefined) {
            var pct = Math.round(currentOpacity * 100);
            document.getElementById('color-opacity-slider').value = pct;
            document.getElementById('color-opacity-val').textContent = pct + '%';
        } else {
            document.getElementById('color-opacity-slider').value = 100;
            document.getElementById('color-opacity-val').textContent = '100%';
        }

        /* Update favorites and recent displays */
        this.renderFavorites();
        this.renderRecent();

        document.getElementById('color-panel').classList.add('open');
        document.getElementById('color-panel-overlay').classList.add('open');
    },

    close: function() {
        this.isOpen = false;
        this.currentTarget = null;
        this.currentCallback = null;

        document.getElementById('color-panel').classList.remove('open');
        document.getElementById('color-panel-overlay').classList.remove('open');
    },

    selectColor: function(color) {
        this.updateAllInputs(color);
        this.addToRecent(color);
        this.renderRecent();

        if (this.currentCallback) {
            this.currentCallback(color, null);
        }
    },

    updateAllInputs: function(hex) {
        hex = hex.toUpperCase();
        document.getElementById('color-spectrum').value = hex;
        document.getElementById('color-hex-input').value = hex;
        document.getElementById('color-preview-box').style.background = hex;

        var rgb = this.hexToRgb(hex);
        if (rgb) {
            document.getElementById('color-r-input').value = rgb.r;
            document.getElementById('color-g-input').value = rgb.g;
            document.getElementById('color-b-input').value = rgb.b;
        }
    },

    updateFromSpectrum: function(hex) {
        this.updateAllInputs(hex);
    },

    updateFromHex: function(hex) {
        this.updateAllInputs(hex);
    },

    updateFromRGB: function() {
        var r = parseInt(document.getElementById('color-r-input').value) || 0;
        var g = parseInt(document.getElementById('color-g-input').value) || 0;
        var b = parseInt(document.getElementById('color-b-input').value) || 0;

        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        var hex = this.rgbToHex(r, g, b);
        document.getElementById('color-spectrum').value = hex;
        document.getElementById('color-hex-input').value = hex.toUpperCase();
        document.getElementById('color-preview-box').style.background = hex;
    },

    /* ---- Favorites ---- */
    pinColor: function(color) {
        color = color.toUpperCase();

        /* If already pinned, remove it first (so it moves to front) */
        for (var i = this.favorites.length - 1; i >= 0; i--) {
            if (this.favorites[i] === color) {
                this.favorites.splice(i, 1);
            }
        }

        /* Add to front */
        this.favorites.unshift(color);

        /* Trim to max */
        if (this.favorites.length > this.maxFavorites) {
            this.favorites.pop();
        }

        this.renderFavorites();
        App.showToast('Color pinned to favorites!', { duration: 1200 });
    },

    removeFavorite: function(color) {
        color = color.toUpperCase();
        for (var i = this.favorites.length - 1; i >= 0; i--) {
            if (this.favorites[i] === color) {
                this.favorites.splice(i, 1);
            }
        }
        this.renderFavorites();
        App.showToast('Color removed from favorites.', { duration: 1200 });
    },

    renderFavorites: function() {
        var container = document.getElementById('color-fav-grid');
        var emptyMsg = document.getElementById('color-fav-empty');
        var self = this;

        /* Remove old swatches but keep the empty message */
        var oldSwatches = container.querySelectorAll('.color-fav-item');
        for (var i = 0; i < oldSwatches.length; i++) {
            oldSwatches[i].remove();
        }

        if (this.favorites.length === 0) {
            emptyMsg.style.display = 'block';
            return;
        }

        emptyMsg.style.display = 'none';

        for (var f = 0; f < this.favorites.length; f++) {
            var color = this.favorites[f];

            var wrap = document.createElement('div');
            wrap.className = 'color-fav-item';

            var swatch = document.createElement('button');
            swatch.className = 'color-preset color-fav-swatch';
            swatch.setAttribute('data-color', color);
            swatch.style.background = color;
            if (color === '#FFFFFF') swatch.style.border = '1px solid #3A3A5A';
            swatch.title = color;
            swatch.addEventListener('click', (function(c) {
                return function() { self.selectColor(c); };
            })(color));

            var removeBtn = document.createElement('button');
            removeBtn.className = 'color-fav-remove';
            removeBtn.textContent = '\u2715';
            removeBtn.title = 'Remove from favorites';
            removeBtn.addEventListener('click', (function(c) {
                return function(e) {
                    e.stopPropagation();
                    self.removeFavorite(c);
                };
            })(color));

            wrap.appendChild(swatch);
            wrap.appendChild(removeBtn);
            container.appendChild(wrap);
        }
    },

    /* ---- Recent Colors ---- */
    addToRecent: function(color) {
        color = color.toUpperCase();

        /* Remove if already in recent */
        for (var i = this.recent.length - 1; i >= 0; i--) {
            if (this.recent[i] === color) {
                this.recent.splice(i, 1);
            }
        }

        /* Add to front */
        this.recent.unshift(color);

        /* Trim to max */
        if (this.recent.length > this.maxRecent) {
            this.recent.pop();
        }
    },

    renderRecent: function() {
        var container = document.getElementById('color-recent-grid');
        var emptyMsg = document.getElementById('color-recent-empty');
        var self = this;

        /* Remove old swatches */
        var oldSwatches = container.querySelectorAll('.color-recent-item');
        for (var i = 0; i < oldSwatches.length; i++) {
            oldSwatches[i].remove();
        }

        if (this.recent.length === 0) {
            emptyMsg.style.display = 'block';
            return;
        }

        emptyMsg.style.display = 'none';

        for (var r = 0; r < this.recent.length; r++) {
            var color = this.recent[r];

            var swatch = document.createElement('button');
            swatch.className = 'color-preset color-recent-item';
            swatch.setAttribute('data-color', color);
            swatch.style.background = color;
            if (color === '#FFFFFF') swatch.style.border = '1px solid #3A3A5A';
            swatch.title = color;
            swatch.addEventListener('click', (function(c) {
                return function() { self.selectColor(c); };
            })(color));

            container.appendChild(swatch);
        }
    },

    /* ---- Eyedropper ---- */
    startEyedropper: function() {
        var self = this;

        /* Try native EyeDropper API first (Chrome/Edge) */
        if (window.EyeDropper) {
            var dropper = new EyeDropper();
            dropper.open().then(function(result) {
                self.selectColor(result.sRGBHex);
            }).catch(function() {
                /* User cancelled */
            });
            return;
        }

        /* Fallback: canvas eyedropper */
        this.close();
        App.showToast('Click anywhere on the board to pick a color.', { duration: 3000 });

        var container = document.getElementById('canvas-container');
        container.style.cursor = 'crosshair';

        var handler = function(opt) {
            var pointer = Board.canvas.getPointer(opt.e);
            var ctx = Board.canvas.getContext();

            /* Get the pixel at the pointer location */
            var vpt = Board.canvas.viewportTransform;
            var screenX = pointer.x * vpt[0] + vpt[4];
            var screenY = pointer.y * vpt[3] + vpt[5];

            var pixel = ctx.getImageData(Math.round(screenX), Math.round(screenY), 1, 1).data;
            var hex = self.rgbToHex(pixel[0], pixel[1], pixel[2]);

            container.style.cursor = 'default';
            Board.canvas.off('mouse:down', handler);
            App.hideToast();

            /* Reopen color panel with picked color */
            self.open(self.currentTarget, self.currentCallback, hex);
            self.selectColor(hex);
        };

        Board.canvas.on('mouse:down', handler);
    },

    /* ---- Utility Functions ---- */
    hexToRgb: function(hex) {
        hex = hex.replace('#', '');
        if (hex.length !== 6) return null;
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16)
        };
    },

    rgbToHex: function(r, g, b) {
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }
};
