/**
 * Screen Wake Lock Manager for SV 1845 Esslingen DJ Pult
 * Keeps tablet screen awake during volleyball matches.
 */

export class WakeLockManager {
  constructor() {
    this.sentinel = null;
    this.enabled = true;
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
  }

  async requestLock() {
    if (this.isActive()) return true;

    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return false;
    }

    if (!this.enabled) return false;

    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });

      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this._onVisibilityChange);
        document.addEventListener('visibilitychange', this._onVisibilityChange);
      }
      return true;
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
      this.sentinel = null;
      return false;
    }
  }

  async releaseLock() {
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (err) {
        console.warn('Wake Lock release error:', err);
      }
      this.sentinel = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
  }

  async _onVisibilityChange() {
    if (document.visibilityState === 'visible' && this.enabled && !this.sentinel) {
      await this.requestLock();
    }
  }

  isActive() {
    return this.sentinel !== null && !this.sentinel.released;
  }
}
