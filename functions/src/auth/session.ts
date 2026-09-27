/**
 * Session/audit callables (Phase 2 §50, ARCHITECTURE §9). On an interactive sign-in the client
 * calls logSession: the server stamps lastInteractiveSignInAt (used for the 30-day window),
 * ensures the user profile exists, and writes an immutable login activity entry.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { logAudit } from '../utils/logger.js';

const logSessionSchema = z.object({
  businessId: z.string().min(1),
  event: z.enum(['login', 'logout']),
});

export const logSession = defineCallable(logSessionSchema, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);

  const batch = db.batch();

  // Ensure a minimal user profile exists and track membership (ARCHITECTURE §6.1).
  const userRef = db.doc(`users/${actor.uid}`);
  batch.set(
    userRef,
    {
      uid: actor.uid,
      email: actor.token.email ?? actor.member.email ?? null,
      businessIds: FieldValue.arrayUnion(input.businessId),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  if (input.event === 'login') {
    batch.update(db.doc(`businesses/${input.businessId}/members/${actor.uid}`), {
      lastInteractiveSignInAt: FieldValue.serverTimestamp(),
    });
  }

  // Immutable activity log entry (server-written, §50, BR-ADM-04).
  const logRef = db.collection(`businesses/${input.businessId}/activityLog`).doc();
  batch.set(logRef, {
    id: logRef.id,
    businessId: input.businessId,
    at: FieldValue.serverTimestamp(),
    actorUid: actor.uid,
    actorName: actor.member.displayName ?? actor.member.email ?? actor.uid,
    action: input.event,
    target: null,
    details: {},
    schemaVersion: 1,
  });

  await batch.commit();
  logAudit(`session.${input.event}`, { businessId: input.businessId, actor: actor.uid });
  return { ok: true };
});
