var SUPABASE_URL = 'https://mutnhfdqbuefkvguljhm.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11dG5oZmRxYnVlZmt2Z3VsamhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDczMTMsImV4cCI6MjA4ODIyMzMxM30.IpRi1vAx752EpRttONAReO5UbzuInzHZHvhabuiK4Sw';

var supabaseClient = null;

try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch(e) {
    document.getElementById('login-error').textContent = 'Supabase failed to load: ' + e.message;
    document.getElementById('login-error').style.display = 'block';
}

var Auth = {
    currentUser: null,
    userProfile: null,
    lockTimer: null,
    lockTimeout: 15,

    init: function() {
        var self = this;

        if (!supabaseClient) {
            document.getElementById('login-error').textContent = 'Cannot connect to database. Supabase library did not load.';
            document.getElementById('login-error').style.display = 'block';
            return;
        }

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
            errorEl.textContent = 'Database not connected.';
            errorEl.style.display = 'block';
            return;
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
            error​​​​​​​​​​​​​​​​
