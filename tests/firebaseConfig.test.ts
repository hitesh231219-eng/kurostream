import { describe, it, expect, vi } from 'vitest';
import firebaseConfig from '../firebase-applet-config.json';
import { db, validateFirestoreConnection } from '../src/services/firebase';

describe('Firebase Firestore Configuration & Connectivity', () => {
  it('initializes Firestore against the provisioned named database with long-polling enabled', () => {
    expect(firebaseConfig.projectId).toBeTruthy();
    expect(firebaseConfig.firestoreDatabaseId).toBeTruthy();
    expect(db.app.options.projectId).toBe(firebaseConfig.projectId);
    expect((db as unknown as { _databaseId?: { database?: string } })._databaseId?.database).toBe(
      firebaseConfig.firestoreDatabaseId
    );
    expect(
      (db as unknown as { _settings?: { experimentalForceLongPolling?: boolean; useFetchStreams?: boolean } })._settings
        ?.experimentalForceLongPolling
    ).toBe(true);
    expect(
      (db as unknown as { _settings?: { experimentalForceLongPolling?: boolean; useFetchStreams?: boolean } })._settings
        ?.useFetchStreams
    ).toBe(false);
  });

  it('validates live Cloud Firestore reachability without offline or 10s backend timeout errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const ok = await validateFirestoreConnection();
      expect(ok).toBe(true);
      const loggedErrors = errorSpy.mock.calls.flat().map(String).join('\n');
      expect(loggedErrors).not.toContain('Please check your Firebase configuration.');
      expect(loggedErrors).not.toContain('Could not reach Cloud Firestore backend');
    } finally {
      errorSpy.mockRestore();
    }
  });
});
