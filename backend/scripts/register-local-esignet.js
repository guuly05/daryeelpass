import 'dotenv/config';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(backendRoot, '.secrets');
const outputPath = path.join(outputDirectory, 'esignet-client.json');
const issuer = process.env.ESIGNET_ISSUER_URL || 'http://localhost:8080';
const clientId = process.env.ESIGNET_CLIENT_ID || 'daryeelpass-local';
const redirectUri = process.env.ESIGNET_REDIRECT_URI || 'http://localhost:4000/api/v1/auth/esignet/callback';

try {
  const existing = JSON.parse(await readFile(outputPath, 'utf8'));
  console.info(`Local eSignet client already registered: ${existing.client_id}`);
  process.exit(0);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: 'jwk' });
const thumbprintInput = JSON.stringify({ e: publicJwk.e, kty: publicJwk.kty, n: publicJwk.n });
const kid = createHash('sha256').update(thumbprintInput).digest('base64url');
const publicKeyJwk = { ...publicJwk, kid, use: 'sig' };

const response = await fetch(`${issuer}/client-mgmt/client`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    requestTime: new Date().toISOString(),
    request: {
      clientId,
      clientName: 'DaryeelPass Local',
      clientNameLangMap: { eng: 'DaryeelPass Local' },
      relyingPartyId: 'decl-ou-1',
      logoUri: 'https://example.com/logo.png',
      redirectUris: [redirectUri],
      userClaims: ['name'],
      authContextRefs: ['mosip:idp:acr:generated-code', 'mosip:idp:acr:password'],
      publicKey: publicKeyJwk,
      grantTypes: ['authorization_code'],
      clientAuthMethods: ['private_key_jwt'],
      additionalConfig: {
        require_pushed_authorization_requests: false,
        dpop_bound_access_tokens: false,
        require_pkce: true
      }
    }
  })
});
const body = await response.json();
if (!response.ok || body.errors?.length || body.response?.status !== 'ACTIVE') {
  throw new Error(`eSignet client registration failed (${response.status}): ${JSON.stringify(body.errors ?? body)}`);
}

await mkdir(outputDirectory, { recursive: true });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
await writeFile(outputPath, `${JSON.stringify({ issuer, client_id: clientId, redirect_uri: redirectUri, private_key_pem: privateKeyPem }, null, 2)}\n`, { flag: 'wx' });
console.info(`Registered local eSignet client: ${clientId}`);
console.info(`Private key saved locally at ${outputPath}`);
