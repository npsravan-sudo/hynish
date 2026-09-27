/**
 * Membership Firestore triggers (ARCHITECTURE §6.5). Keeps users/{uid}.businessIds in sync and
 * revokes refresh tokens when a member is deactivated or removed (defense in depth for §31/§33).
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { db, adminAuth, REGION } from '../config/app.js';
import { logSecurity } from '../utils/logger.js';

export const onMemberWritten = onDocumentWritten(
  { region: REGION, document: 'businesses/{businessId}/members/{uid}' },
  async (event) => {
    const businessId = event.params.businessId;
    const uid = event.params.uid;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    const userRef = db.doc(`users/${uid}`);

    // Removed or deactivated -> drop the business and revoke sessions.
    const wasActive = before?.active === true;
    const isActive = after?.active === true;

    if (!after) {
      await userRef.set({ businessIds: FieldValue.arrayRemove(businessId) }, { merge: true }).catch(() => undefined);
      await adminAuth.revokeRefreshTokens(uid).catch(() => undefined);
      logSecurity('member.removed', { businessId, target: uid });
      return;
    }

    if (isActive) {
      await userRef.set({ businessIds: FieldValue.arrayUnion(businessId) }, { merge: true }).catch(() => undefined);
    } else {
      await userRef.set({ businessIds: FieldValue.arrayRemove(businessId) }, { merge: true }).catch(() => undefined);
    }

    if (wasActive && !isActive) {
      await adminAuth.revokeRefreshTokens(uid).catch(() => undefined);
      logSecurity('member.deactivated', { businessId, target: uid });
    }
  },
);
