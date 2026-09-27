import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
import { makeTestEnv, seed, freshToken, BIZ, OTHER_BIZ } from './helpers.js';

let env: RulesTestEnvironment;

const authedStorage = (uid: string) => env.authenticatedContext(uid, freshToken()).storage();
const unauthedStorage = () => env.unauthenticatedContext().storage();

const imageMeta = { contentType: 'image/jpeg' };
const smallImage = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); // tiny JPEG-ish payload

beforeAll(async () => {
  env = await makeTestEnv();
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearStorage();
  await seed(env);
});

describe('Storage rules — product images (§41)', () => {
  it('denies unauthenticated uploads', async () => {
    const r = ref(unauthedStorage(), `businesses/${BIZ}/products/p1/a.jpg`);
    await assertFails(uploadBytes(r, smallImage, imageMeta));
  });

  it('allows a members-who-manage-products upload of a small image', async () => {
    const r = ref(authedStorage('shop1'), `businesses/${BIZ}/products/p1/a.jpg`);
    await assertSucceeds(uploadBytes(r, smallImage, imageMeta));
  });

  it('denies uploads to another business', async () => {
    const r = ref(authedStorage('outsider'), `businesses/${BIZ}/products/p1/a.jpg`);
    await assertFails(uploadBytes(r, smallImage, imageMeta));
  });

  it('denies an inactive member', async () => {
    const r = ref(authedStorage('inactive'), `businesses/${BIZ}/products/p1/a.jpg`);
    await assertFails(uploadBytes(r, smallImage, imageMeta));
  });

  it('denies non-image uploads', async () => {
    const r = ref(authedStorage('shop1'), `businesses/${BIZ}/products/p1/evil.txt`);
    await assertFails(uploadBytes(r, smallImage, { contentType: 'text/plain' }));
  });

  it('denies oversize uploads (> 1MB)', async () => {
    const big = new Uint8Array(1024 * 1024 + 10);
    const r = ref(authedStorage('shop1'), `businesses/${BIZ}/products/p1/big.jpg`);
    await assertFails(uploadBytes(r, big, imageMeta));
  });

  it('members can read product images but cannot write branding or backups', async () => {
    const branding = ref(authedStorage('owner'), `businesses/${BIZ}/branding/logo.jpg`);
    await assertFails(uploadBytes(branding, smallImage, imageMeta));
    const backup = ref(authedStorage('owner'), `businesses/${BIZ}/backups/b.json`);
    await assertFails(uploadBytes(backup, smallImage, { contentType: 'application/json' }));
  });

  it('denies uploads to an unknown path', async () => {
    const r = ref(authedStorage('owner'), `businesses/${BIZ}/secrets/x.jpg`);
    await assertFails(uploadBytes(r, smallImage, imageMeta));
  });
});

// Reference read: an uploaded product image is readable by a member of the business.
describe('Storage rules — reads', () => {
  it('a member can read an uploaded product image', async () => {
    const put = ref(authedStorage('shop1'), `businesses/${BIZ}/products/p1/read.jpg`);
    await assertSucceeds(uploadBytes(put, smallImage, imageMeta));
    const get = ref(authedStorage('accountant'), `businesses/${BIZ}/products/p1/read.jpg`);
    await assertSucceeds(getBytes(get));
  });

  it('a member of another business cannot read the image', async () => {
    const put = ref(authedStorage('shop1'), `businesses/${BIZ}/products/p1/read2.jpg`);
    await assertSucceeds(uploadBytes(put, smallImage, imageMeta));
    const get = ref(authedStorage('outsider'), `businesses/${BIZ}/products/p1/read2.jpg`);
    await assertFails(getBytes(get));
  });
});

void OTHER_BIZ;
