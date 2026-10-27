import { createHash, createPublicKey, randomBytes, randomUUID, sign, verify, constants } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

let clientConfigPromise;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeSegment(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

export async function loadEsignetClient() {
  if (!clientConfigPromise) {
    clientConfigPromise = (async () => {
      const filePath = path.resolve(process.cwd(), config.ESIGNET_CLIENT_CONFIG_FILE);
      const local = JSON.parse(await readFile(filePath, 'utf8'));
      const issuer = config.ESIGNET_ISSUER_URL || local.issuer;
      const clientId = config.ESIGNET_CLIENT_ID || local.client_id;
      const redirectUri = config.ESIGNET_REDIRECT_URI || local.redirect_uri;
      const privateKey = local.private_key_pem;
      if (!issuer || !clientId || !redirectUri || !privateKey) throw new Error('Local eSignet client configuration is incomplete.');
      const publicJwk = createPublicKey(privateKey).export({ format: 'jwk' });
      const kid = createHash('sha256').update(JSON.stringify({ e: publicJwk.e, kty: publicJwk.kty, n: publicJwk.n })).digest('base64url');
      const response = await fetch(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`eSignet discovery returned HTTP ${response.status}.`);
      const metadata = await response.json();
      if (metadata.issuer !== issuer) throw new Error('eSignet discovery issuer does not match the configured issuer.');
      return { issuer, clientId, redirectUri, privateKey, kid, metadata };
    })();
  }
  return clientConfigPromise;
}

export function makePrivateKeyAssertion({ clientId, audience, privateKey, kid }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
  const payload = base64url(JSON.stringify({
    iss: clientId,
    sub: clientId,
    aud: audience,
    iat: now,
    exp: now + 300,
    jti: randomUUID()
  }));
  const signingInput = `${header}.${payload}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput), privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

export async function verifyEsignetJwt(token, { client, expectedAudience, expectedNonce, userInfo = false }) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('eSignet returned a token in an unsupported format.');
  const header = decodeSegment(parts[0]);
  const claims = decodeSegment(parts[1]);
  const jwksResponse = await fetch(client.metadata.jwks_uri, { headers: { accept: 'application/json' } });
  if (!jwksResponse.ok) throw new Error(`eSignet JWKS returned HTTP ${jwksResponse.status}.`);
  const jwks = await jwksResponse.json();
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error('The signing key for the eSignet token was not found.');
  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const signature = Buffer.from(parts[2], 'base64url');
  const signedBytes = Buffer.from(`${parts[0]}.${parts[1]}`);
  let valid = false;
  if (header.alg === 'RS256') valid = verify('RSA-SHA256', signedBytes, publicKey, signature);
  if (header.alg === 'PS256') {
    valid = verify('sha256', signedBytes, { key: publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }, signature);
  }
  if (!valid) throw new Error('The eSignet token signature is invalid or uses an unsupported algorithm.');
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp <= now) throw new Error('The eSignet token has expired.');
  if (claims.nbf && claims.nbf > now) throw new Error('The eSignet token is not yet valid.');
  if (!userInfo) {
    if (claims.iss !== client.issuer) throw new Error('The eSignet token issuer is invalid.');
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(expectedAudience)) throw new Error('The eSignet token audience is invalid.');
    if (!claims.sub || claims.nonce !== expectedNonce) throw new Error('The eSignet token nonce is invalid.');
  }
  return claims;
}

export function createPkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}
