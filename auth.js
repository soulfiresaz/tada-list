/* ============================================
   TaDa List — Authentication (auth.js)
   Version 1.0.0
   Handles: login, signup, logout, session,
   quick lock, password reset
   ============================================ */

// ---- Supabase Configuration ----
const SUPABASE_URL = 'https://mutnhfdqbuefkvguljhm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11dG5oZmRxYnVlZmt2Z3VsamhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDczMTMsImV4cCI6MjA4ODIyMzMxM30.IpRi1vAx752EpRttONAReO5UbzuInzHZHvhabuiK4Sw';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Auth Module ----
const Auth = {
    currentUser: null,
    userProfile: null,
    lockTimer: null,
    lockTimeout: 15, // minutes, loaded from profile later

    // ==========================================
    // INITIALIZATION
    // ==========================================
    async init() {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            this.currentUser = session.user;
            await this.loadProfile();
            this.showScreen('app');
            this.startLockTimer();
        } else {
            this.showScreen('login');
        }

        // Listen for auth state changes
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                this.currentUser = session.user;
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.userProfile = null;
                this.showScreen('login');
            }
        });

        // Track user activity for lock timer
        this.trackActivity();

        // Load tagline from app_settings
        this.loadTagline();
    },

    // ==========================================
    // SCREEN MANAGEMENT
    // ==========================================
    showScreen(name) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

        // Show requested screen
        const screen = document.getElementById(name + '-screen');
        if (screen) {
            screen.classList.add('active');
        }

        // If showing app screen, initialize the app
        if (name === 'app' && typeof App !== 'undefined') {
            App.init();
        }
    },

    showLoading() {
        this.showScreen('loading');
    },

    // ==========================================
    // LOGIN
    // ==========================================
    async login() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');

        // Basic validation
        if (!email || !password) {
            this.showError(errorEl, 'Please enter your email and password.');
            return;
        }

        // Disable button while processing
        const btn = document.getElementById('login-btn');
        btn.disabled = true;
        btn.textContent = 'Logging in...';

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                this.showError(errorEl, error.message);
                btn.disabled = false;
                btn.textContent = 'Log In';
                return;
            }

            this.currentUser = data.user;
            errorEl.style.display = 'none';

            // Show loading screen while data loads
            this.showLoading();

            // Load user profile
            await this.loadProfile();

            // Start lock timer
            this.startLockTimer();

            // Show the app
            this.showScreen('app');

        } catch (err) {
            this.showError(errorEl, 'Something went wrong. Please try again.');
            console.error('Login error:', err);
        }

        btn.disabled = false;
        btn.textContent = 'Log In';
    },

    // ==========================================
    // SIGN UP (invite-only)
    // ==========================================
    async signUp() {
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const errorEl = document.getElementById('signup-error');

        if (!email || !password) {
            this.showError(errorEl, 'Please enter your email and password.');
            return;
        }

        if (password.length < 6) {
            this.showError(errorEl, 'Password must be at least 6 characters.');
            return;
        }

        const btn = document.getElementById('signup-btn');
        btn.disabled = true;
        btn.textContent = 'Signing up...';

        try {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password
            });

            if (error) {
                this.showError(errorEl, error.message);
                btn.disabled = false;
                btn.textContent = 'Sign Up';
                return;
            }

            // If sign up is disabled for non-invited users, Supabase will return an error
            // If successful, show a message
            errorEl.style.display = 'none';
            this.showError(errorEl, ''); // Clear error

            // Show success and switch to login
            alert('Account created! You can now log in.');
            this.showLogin();

        } catch (err) {
            this.showError(errorEl, 'Something went wrong. Please try again.');
            console.error('Signup error:', err);
        }

        btn.disabled = false;
        btn.textContent = 'Sign Up';
    },

    // ==========================================
    // FORGOT PASSWORD
    // ==========================================
    async sendPasswordReset() {
        const email = document.getElementById('forgot-email').value.trim();
        const errorEl = document.getElementById('forgot-error');
        const successEl = document.getElementById('forgot-success');

        if (!email) {
            this.showError(errorEl, 'Please enter your email.');
            return;
        }

        const btn = document.getElementById('forgot-btn');
        btn.disabled = true;
        btn.textContent = 'Sending...';

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);

            if (error) {
                this.showError(errorEl, error.message);
            } else {
                errorEl.style.display = 'none';
                successEl.style.display = 'block';
                successEl.textContent = 'Check your email for a password reset link!';
            }
        } catch (err) {
            this.showError(errorEl, 'Something went wrong. Please try again.');
            console.error('Password reset error:', err);
        }

        btn.disabled = false;
        btn.textContent = 'Send Reset Link';
    },

    // ==========================================
    // QUICK LOCK
    // ==========================================
    lock() {
        if (!this.currentUser) return;

        // Show lock screen with user's email
        document.getElementById('lock-email-display').textContent = this.currentUser.email;
        document.getElementById('lock-password').value = '';
        document.getElementById('lock-error').style.display = 'none';
        this.showScreen('lock');
        this.stopLockTimer();
    },

    async unlock() {
        const password = document.getElementById('lock-password').value;
        const errorEl = document.getElementById('lock-error');

        if (!password) {
            this.showError(errorEl, 'Please enter your password.');
            return;
        }

        try {
            // Re-authenticate with Supabase
            const { data, error } = await supabase.auth.signInWithPassword({
                email: this.currentUser.email,
                password: password
            });

            if (error) {
                this.showError(errorEl, 'Incorrect password.');
                return;
            }

            errorEl.style.display = 'none';
            this.showScreen('app');
            this.startLockTimer();

        } catch (err) {
            this.showError(errorEl, 'Something went wrong. Please try again.');
            console.error('Unlock error:', err);
        }
    },

    // ==========================================
    // LOCK TIMER
    // ==========================================
    startLockTimer() {
        this.stopLockTimer();

        // "Never" option = 0 means don't lock
        if (this.lockTimeout <= 0) return;

        const timeoutMs = this.lockTimeout * 60 * 1000;
        this.lockTimer = setTimeout(() => {
            this.lock();
        }, timeoutMs);
    },

    stopLockTimer() {
        if (this.lockTimer) {
            clearTimeout(this.lockTimer);
            this.lockTimer = null;
        }
    },

    resetLockTimer() {
        if (this.lockTimeout > 0 && this.currentUser) {
            this.startLockTimer();
        }
    },

    trackActivity() {
        // Reset lock timer on any user activity
        const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.resetLockTimer();
            }, { passive: true });
        });
    },

    // ==========================================
    // LOGOUT
    // ==========================================
    async fullLogout() {
        this.stopLockTimer();
        await supabase.auth.signOut();
        this.currentUser = null;
        this.userProfile = null;
        this.showScreen('login');

        // Clear form fields
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
    },

    // ==========================================
    // PROFILE
    // ==========================================
    async loadProfile() {
        if (!this.currentUser) return;

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error) {
                console.error('Error loading profile:', error);
                return;
            }

            this.userProfile = data;

            // Apply user's lock timeout setting
            if (data.auto_lock_timeout !== null && data.auto_lock_timeout !== undefined) {
                this.lockTimeout = data.auto_lock_timeout;
            }

        } catch (err) {
            console.error('Error loading profile:', err);
        }
    },

    // ==========================================
    // TAGLINE
    // ==========================================
    async loadTagline() {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('tagline')
                .eq('id', 1)
                .single();

            if (data && data.tagline) {
                document.getElementById('login-tagline').textContent = data.tagline;
            }
        } catch (err) {
            // Silently fail — default tagline in HTML is fine
            console.error('Error loading tagline:', err);
        }
    },

    // ==========================================
    // FORM SWITCHING
    // ==========================================
    showLogin() {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('forgot-form').style.display = 'none';
        this.clearErrors();
    },

    showSignUp() {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'block';
        document.getElementById('forgot-form').style.display = 'none';
        this.clearErrors();
    },

    showForgotPassword() {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('forgot-form').style.display = 'block';
        this.clearErrors();
    },

    // Alias for the onclick in HTML
    forgotPassword() {
        this.showForgotPassword();
    },

    // ==========================================
    // HELPERS
    // ==========================================
    showError(element, message) {
        element.textContent = message;
        element.style.display = message ? 'block' : 'none';
    },

    clearErrors() {
        document.querySelectorAll('.error-msg, .success-msg').forEach(el => {
            el.style.display = 'none';
        });
    },

    // Check if current user is admin (owner or temp_admin)
    isAdmin() {
        return this.userProfile && (this.userProfile.role === 'owner' || this.userProfile.role === 'temp_admin');
    },

    // Check if current user is the owner
    isOwner() {
        return this.userProfile && this.userProfile.role === 'owner';
    }
};

// Allow pressing Enter to submit login
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') Auth.login();
    });
    document.getElementById('login-email').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') Auth.login();
    });
    document.getElementById('lock-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') Auth.unlock();
    });
});
