/*
 * server/auth.js — tiny HMAC token issuer/verifier (no deps).
 * Secret is read from env VELORA_SECRET or a stable default; in a real
 * deployment set VELORA_SECRET to a long random value.
 */
'use strict';

const crypto = require('node:crypto');

function getSecret() {
  return (
    process.env.VELORA_SECRET ||
    'velora-cafe-dev-secret-change-me-in-production-7f3a91c2'
  );
}

// Signed token = base64url(payload).base64url(HMAC-SHA256(payload))
function signToken(payload, expiresInSeconds = 60 * 60 * 24) {
  const body = { ...payload, iat: Math.floor(Date.now() / 1000) };
  body.exp = body.iat + expiresInSeconds;
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

// Returns decoded payload if valid & unexpired, otherwise null.
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto
    .createHmac('sha256', getSecret())
    .update(encoded)
    .digest('base64url');
  // timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { signToken, verifyToken, getSecret };
