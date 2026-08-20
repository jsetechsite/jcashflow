/**
 * CashFlow PWA — Progressive Web App Controller
 * Manages service worker lifecycle, installation prompts, and offline handling.
 */

class PWAController {
  constructor() {
    this.deferredPrompt = null;
    this.init();
  }

  init() {
    this.registerServiceWorker();
    this.handleInstallPrompt();
    this.handleNetworkStatus();
    this.handleAppUpdate();
  }

  // Reload once when a newer service worker takes control (new build deployed)
  handleAppUpdate() {
    if (!('serviceWorker' in navigator)) return;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      if (window.app) window.app.showToast('New version available — reloading…', 'info', '🔄');
      setTimeout(() => window.location.reload(), 600);
    });
  }

  // Register Service Worker
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => {
            console.log('✅ CashFlow Service Worker registered:', reg.scope);
          })
          .catch(err => {
            console.warn('Service worker registration failed:', err);
          });
      });
    }
  }

  // Handle "Add to Home Screen"
  handleInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      
      // Show install banner/button if exists
      const installBtn = document.getElementById('pwaInstallBtn');
      if (installBtn) {
        installBtn.style.display = 'inline-flex';
        installBtn.addEventListener('click', () => this.promptInstall());
      }
    });

    window.addEventListener('appinstalled', () => {
      console.log('🎉 CashFlow PWA was installed successfully!');
      this.deferredPrompt = null;
      const installBtn = document.getElementById('pwaInstallBtn');
      if (installBtn) installBtn.style.display = 'none';
      if (window.app) window.app.showToast('CashFlow installed to Home Screen!', 'success', '📱');
    });
  }

  async promptInstall() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log(`Install prompt outcome: ${outcome}`);
    this.deferredPrompt = null;
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) installBtn.style.display = 'none';
  }

  // Handle Online / Offline network changes
  handleNetworkStatus() {
    window.addEventListener('online', () => {
      if (window.app) {
        window.app.showToast('You are back online. Cloud sync active.', 'success', '🌐');
        window.app.updateCloudStatus();
      }
    });

    window.addEventListener('offline', () => {
      if (window.app) {
        window.app.showToast('Offline mode active. Changes saved locally.', 'info', '⚡');
        const statusText = document.getElementById('cloudStatusText');
        const dot = document.getElementById('cloudStatusDot');
        if (statusText && dot) {
          statusText.textContent = 'Offline Mode';
          dot.style.background = '#f59e0b';
        }
      }
    });
  }
}

window.pwa = new PWAController();
