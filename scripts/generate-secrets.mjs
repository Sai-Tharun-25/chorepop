import { generateKeyPairSync, randomBytes } from 'node:crypto';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, 'base64url'),
  Buffer.from(jwk.y, 'base64url')
]).toString('base64url');
const householdCode = randomBytes(18).toString('base64url');
console.log(`\nHOUSEHOLD_CODE=${householdCode}`);
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log('VAPID_SUBJECT=mailto:YOU@YOUR-EMAIL.COM');
console.log('\nSave these privately. Never commit them to GitHub.');
