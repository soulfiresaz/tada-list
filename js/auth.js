var SUPABASE_URL = 'https://mutnhfdqbuefkvguljhm.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11dG5oZmRxYnVlZmt2Z3VsamhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDczMTMsImV4cCI6MjA4ODIyMzMxM30.IpRi1vAx752EpRttONAReO5UbzuInzHZHvhabuiK4Sw';

var supabaseClient = null;

function initSupabase() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }
    return false;
}

var Auth = {
    currentUser: null,
    userProfile: null,
    lockTimer: null,
    lockTimeout: 15,

    init: function() {
        if (!initSupabase()) {
            document.getElementById('login-error').textContent = 'Database library not loaded. Please refresh the page.';
            document.getElementById('login-error').style.display = 'block';
            return;
        }

        var self = this;

        supabaseClient.auth.getSession().then(function(result) {
            if (result.data.session) {
                self.currentUser = result.data.session.user;
                self.loadProfile().then(function() {
                    self.showScreen('app');
                    self.startLockTimer();
                });
            } else {
                self.showScreen('login');
            }
        }).catch(function(err) {
            document.getElementById('login-error').textContent = 'Session error: ' + err.message;
            document.getElementById('login-error').style.display = 'block';
        });

        supabaseClient.auth.onAuthStateChange(function(event, session) {
            if (event === 'SIGNED_IN' && session) {
                self.currentUser = session.user;
            } else if (event === 'SIGNED_OUT') {
                self.currentUser = null;
                self.userProfile = null;
                self.showScreen('login');
            }
        });

        this.trackActivity();
        this.loadTagline();
    },

    showScreen: function(name) {
        var screens = document.querySelectorAll('.screen');
        for (var i = 0; i < screens.length; i++) {
            screens[i].classList.remove('active');
        }
        var screen = document.getElementById(name + '-screen');
        if (screen) {
            screen.classList.add('active');
        }
        if (name === 'app' && typeof App !== 'undefined') {
            App.init();
        }
    },

    showLoading: function() {
        this.showScreen('loading');
    },

    login: function() {
        var self = this;
        var email = document.getElementById('login-email').value.trim();
        var password = document.getElementById('login-password').value;
        var errorEl = document.getElementById('login-error');

        if (!email || !password) {
            errorEl.textContent = 'Please enter your email and password.';
            errorEl.style.display = 'block';
            return;
        }

        if (!supabaseClient) {
            if (!initSupabase()) {
                errorEl.textContent = 'Database not ready. Please refresh.';
                errorEl.style.display = 'block';
                return;
            }
        }

        var btn = document.getElementById('login-btn');
        btn.disabled = true;
        btn.textContent = 'Logging in...';
        errorEl.style.display = 'none';

        supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        }).then(function(result) {
            if (result.error) {
                errorEl.textContent = result.error.message;
                errorEl.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'Log In';
                return;
            }
            self.currentUser = result.data.user;
            self.showLoading();
            self.loadProfile().then(function() {
                self.startLockTimer();
                self.showScreen('app');
            });
        }).catch(function(err) {
            errorEl.textContent = 'Login failed: ' + err.message;
            errorEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Log In';
        });
    },

    signUp: function() {
        var email = document.getElementById('signup-email').value.trim();
        var password = document.getElementById('signup-password').value;
        var errorEl = document.getElementById('signup-error');

        if (!email || !password) {
            errorEl.textContent = 'Please enter your email and password.';
            errorEl.style.display = 'block';
            return;
        }
        if (password.length < 6) {
            errorEl.textContent = 'Password must be at least 6 characters.';
            errorEl.style.display = 'block';
            return;
        }

        var btn = document.getElementById('signup-btn');
        btn.disabled = true;
        btn.textContent = 'Signing up...';

        supabaseClient.auth.signUp({
            email: email,
            password: password
        }).then(function(result) {
            if (result.error) {
                errorEl.textContent = result.error.message;
                errorEl.style.display = 'block';
            } else {
                alert('Account created! You can now log in.');
                Auth.showLogin();
            }
            btn.disabled = false;
            btn.textContent = 'Sign Up';
        }).catch(function(err) {
            errorEl.textContent = 'Sign up failed: ' + err.message;
            errorEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Sign Up';
        });
    },

    sendPasswordReset: function() {
        var email = document.getElementById('forgot-email').value.trim();
        var errorEl = document.getElementById('forgot-error');
        var successEl = document.getElementById('forgot-success');

        if (!email) {
            errorEl.textContent = 'Please enter your email.';
            errorEl.style.display = 'block';
            return;
        }

        var btn = document.getElementById('forgot-btn');
        btn.disabled = true;
        btn.textContent = 'Sending...';

        supabaseClient.auth.resetPasswordForEmail(email).then(function(result) {
            if (result.error) {
                errorEl.textContent = result.error.message;
                errorEl.style.display = 'block';
            } else {
                errorEl.style.display = 'none';
                successEl.textContent = 'Check your email for a password reset link!';
                successEl.style.display = 'block';
            }
            btn.disabled = false;
            btn.textContent = 'Send Reset Link';
        }).catch(function(err) {
            errorEl.textContent = 'Error: ' + err.message;
            errorEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Send Reset Link';
        });
    },

    lock: function() {
        if (!this.currentUser) return;
        document.getElementById('lock-email-display').textContent = this.currentUser.email;
        document.getElementById('lock-password').value = '';
        document.getElementById('lock-error').style.display = 'none';
        this.showScreen('lock');
        this.stopLockTimer();
    },

    unlock: function() {
        var self = this;
        var password = document.getElementById('lock-password').value;
        var errorEl = document.getElementById('lock-error');

        if (!password) {
            errorEl.textContent = 'Please enter your password.';
            errorEl.style.display = 'block';
            return;
        }

        supabaseClient.auth.signInWithPassword({
            email: self.currentUser.email,
            password: password
        }).then(function(result) {
            if (result.error) {
                errorEl.textContent = 'Incorrect password.';
                errorEl.style.display = 'block';
            } else {
                errorEl.style.display = 'none';
                self.showScreen('app');
                self.startLockTimer();
            }
        }).catch(function(err) {
            errorEl.textContent = 'Error: ' + err.message;
            errorEl.style.display = 'block';
        });
    },

    startLockTimer: function() {
        this.stopLockTimer();
        if (this.lockTimeout <= 0) return;
        var self = this;
        this.lockTimer = setTimeout(function() {
            self.lock();
        }, this.lockTimeout * 60 * 1000);
    },

    stopLockTimer: function() {
        if (this.lockTimer) {
            clearTimeout(this.lockTimer);
            this.lockTimer = null;
        }
    },

    resetLockTimer: function() {
        if (this.lockTimeout > 0 && this.currentUser) {
            this.startLockTimer();
        }
    },

    trackActivity: function() {
        var self = this;
        var events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
        for (var i = 0; i < events.length; i++) {
            document.addEventListener(events[i], function() {
                self.resetLockTimer();
            }, { passive: true });
        }
    },

    fullLogout: function() {
        this.stopLockTimer();
        supabaseClient.auth.signOut();
        this.currentUser = null;
        this.userProfile = null;
        this.showScreen('login');
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
    },

    loadProfile: function() {
        var self = this;
        if (!this.currentUser) return Promise.resolve();

        return supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', this.currentUser.id)
            .single()
            .then(function(result) {
                if (result.error) {
                    console.error('Profile error:', result.error);
                    return;
                }
                self.userProfile = result.data;
                if (result.data.auto_lock_timeout !== null && result.data.auto_lock_timeout !== undefined) {
                    self.lockTimeout = result.data.auto_lock_timeout;
                }
            }).catch(function(err) {
                console.error('Profile error:', err);
            });
    },

    loadTagline: function() {
        if (!supabaseClient) return;
        supabaseClient
            .from('app_settings')
            .select('tagline')
            .eq('id', 1)
            .single()
            .then(function(result) {
                if (result.data && result.data.tagline) {
                    document.getElementById('login-tagline').textContent = result.data.tagline;
                }
            }).catch(function(err) {
                console.error('Tagline error:', err);
            });
    },

    showLogin: function() {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('forgot-form').style.display = 'none';
        this.clearErrors();
    },

    showSignUp: function() {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'block';
        document.getElementById('forgot-form').style.display = 'none';
        this.clearErrors();
    },

    showForgotPassword: function() {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('forgot-form').style.display = 'block';
        this.clearErrors();
    },

    forgotPassword: function() {
        this.showForgotPassword();
    },

    clearErrors: function() {
        var errors = document.querySelectorAll('.error-msg, .success-msg');
        for (var i = 0; i < errors.length; i++) {
            errors[i].style.display = 'none';
        }
    },

    isAdmin: function() {
        return this.userProfile && (this.userProfile.role === 'owner' || this.userProfile.role === 'temp_admin');
    },

    isOwner: function() {
        return this.userProfile && this.userProfile.role === 'owner';
    }
};
