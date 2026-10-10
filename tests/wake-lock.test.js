import test from 'node:test';
import assert from 'node:assert/strict';
import { WakeLockManager } from '../js/wake-lock.js';

test('WakeLockManager gracefully handles environments without navigator.wakeLock', async () => {
  const manager = new WakeLockManager();
  const acquired = await manager.requestLock();
  assert.equal(acquired, false);
  assert.equal(manager.isActive(), false);
  await manager.releaseLock();
  assert.equal(manager.isActive(), false);
});

test('WakeLockManager acquires, tracks, and releases wake lock with mock navigator', async () => {
  let releaseCalled = false;
  const listeners = {};

  const mockSentinel = {
    released: false,
    addEventListener(event, fn) {
      listeners[event] = fn;
    },
    async release() {
      releaseCalled = true;
      this.released = true;
      if (listeners['release']) {
        listeners['release']();
      }
    }
  };

  let requestedType = null;
  const mockWakeLock = {
    async request(type) {
      requestedType = type;
      return mockSentinel;
    }
  };

  const docListeners = {};
  const mockDoc = {
    visibilityState: 'visible',
    addEventListener(event, fn) {
      docListeners[event] = fn;
    },
    removeEventListener(event, fn) {
      if (docListeners[event] === fn) {
        delete docListeners[event];
      }
    }
  };

  try {
    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      value: mockWakeLock,
      configurable: true,
      writable: true
    });
    globalThis.document = mockDoc;

    const manager = new WakeLockManager();
    assert.equal(manager.isActive(), false);

    const acquired = await manager.requestLock();
    assert.equal(acquired, true);
    assert.equal(requestedType, 'screen');
    assert.equal(manager.isActive(), true);
    assert.ok(docListeners['visibilitychange']);

    await manager.releaseLock();
    assert.equal(releaseCalled, true);
    assert.equal(manager.isActive(), false);
    assert.equal(docListeners['visibilitychange'], undefined);
  } finally {
    delete globalThis.navigator.wakeLock;
    delete globalThis.document;
  }
});

test('WakeLockManager handles external release event on sentinel', async () => {
  let releaseListener = null;
  const mockSentinel = {
    released: false,
    addEventListener(event, fn) {
      if (event === 'release') releaseListener = fn;
    },
    async release() {
      this.released = true;
      if (releaseListener) releaseListener();
    }
  };

  try {
    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      value: {
        async request() {
          return mockSentinel;
        }
      },
      configurable: true,
      writable: true
    });
    globalThis.document = {
      visibilityState: 'visible',
      addEventListener() {},
      removeEventListener() {}
    };

    const manager = new WakeLockManager();
    await manager.requestLock();
    assert.equal(manager.isActive(), true);

    // Simulate system/browser releasing lock externally
    if (releaseListener) {
      mockSentinel.released = true;
      releaseListener();
    }

    assert.equal(manager.isActive(), false);
  } finally {
    delete globalThis.navigator.wakeLock;
    delete globalThis.document;
  }
});

test('WakeLockManager handles request rejection gracefully', async () => {
  try {
    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      value: {
        async request() {
          throw new Error('NotAllowedError: Wake lock denied');
        }
      },
      configurable: true,
      writable: true
    });

    const manager = new WakeLockManager();
    const acquired = await manager.requestLock();
    assert.equal(acquired, false);
    assert.equal(manager.isActive(), false);
  } finally {
    delete globalThis.navigator.wakeLock;
  }
});

test('WakeLockManager re-requests lock on visibilitychange to visible', async () => {
  let requestCount = 0;
  const createSentinel = () => {
    let relListener = null;
    return {
      released: false,
      addEventListener(event, fn) {
        if (event === 'release') relListener = fn;
      },
      async release() {
        this.released = true;
        if (relListener) relListener();
      }
    };
  };

  let docListeners = {};
  const mockDoc = {
    visibilityState: 'visible',
    addEventListener(event, fn) {
      docListeners[event] = fn;
    },
    removeEventListener(event, fn) {
      if (docListeners[event] === fn) {
        delete docListeners[event];
      }
    }
  };

  try {
    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      value: {
        async request() {
          requestCount++;
          return createSentinel();
        }
      },
      configurable: true,
      writable: true
    });
    globalThis.document = mockDoc;

    const manager = new WakeLockManager();
    await manager.requestLock();
    assert.equal(requestCount, 1);
    assert.equal(manager.isActive(), true);

    // Simulate screen lock released when tab was backgrounded
    manager.sentinel = null;
    assert.equal(manager.isActive(), false);

    // Tab becomes visible again
    mockDoc.visibilityState = 'visible';
    await docListeners['visibilitychange']();

    assert.equal(requestCount, 2);
    assert.equal(manager.isActive(), true);

    // Tab changes visibility but is hidden
    manager.sentinel = null;
    mockDoc.visibilityState = 'hidden';
    await docListeners['visibilitychange']();
    // Should NOT request lock when hidden
    assert.equal(requestCount, 2);

    // Cleanup
    await manager.releaseLock();
  } finally {
    delete globalThis.navigator.wakeLock;
    delete globalThis.document;
  }
});

test('WakeLockManager respects enabled flag and release error handling', async () => {
  let requested = false;
  try {
    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      value: {
        async request() {
          requested = true;
          return {
            released: false,
            addEventListener() {},
            async release() {
              throw new Error('Release failed');
            }
          };
        }
      },
      configurable: true,
      writable: true
    });

    const manager = new WakeLockManager();
    manager.enabled = false;
    const acquired = await manager.requestLock();
    assert.equal(acquired, false);
    assert.equal(requested, false);

    manager.enabled = true;
    const acquired2 = await manager.requestLock();
    assert.equal(acquired2, true);
    assert.equal(manager.isActive(), true);

    // release error should not throw
    await manager.releaseLock();
    assert.equal(manager.isActive(), false);
  } finally {
    delete globalThis.navigator.wakeLock;
  }
});
