/**
 * Offline verification of a signed ticket QR.
 *
 * Mirrors backend/services/qr.py: same wire format, same fields, so a device
 * with nothing but the public key can establish that a QR was issued by
 * D-Billet, for which trip, and until when - with no network.
 *
 *     DB1.<base64url payload>.<base64url Ed25519 signature>
 *     payload = ticket_id|service|reference|seat|departure|expires
 *
 * Uses WebCrypto's Ed25519 where the browser has it. Older Android Chrome does
 * not, so @noble/ed25519 is imported on demand - only on the devices that need
 * it, and only inside the scanner chunk.
 */

const PREFIX = 'DB1';
const SEPARATOR = '|';
const LEGACY_PREFIXES = ['DBILLET-', 'TRAIN-', 'FERRY-VEH-', 'FERRY-'];

const b64urlToBytes = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

let nobleLoader = null;
const loadNoble = () => {
  if (!nobleLoader) {
    nobleLoader = import(/* webpackChunkName: "ed25519" */ '@noble/ed25519');
  }
  return nobleLoader;
};

const verifyWithWebCrypto = async (signature, message, publicKey) => {
  const key = await crypto.subtle.importKey(
    'raw', publicKey, { name: 'Ed25519' }, false, ['verify'],
  );
  return crypto.subtle.verify({ name: 'Ed25519' }, key, signature, message);
};

const verifySignature = async (signature, message, publicKey) => {
  try {
    return await verifyWithWebCrypto(signature, message, publicKey);
  } catch (error) {
    // No Ed25519 in this WebCrypto: fall back to the JS implementation.
  }
  try {
    const ed = await loadNoble();
    const verify = ed.verifyAsync || ed.verify || (ed.default && ed.default.verifyAsync);
    return await verify(signature, message, publicKey);
  } catch (error) {
    return false;
  }
};

/**
 * Load whatever this browser needs to verify a signature, while online.
 *
 * Same reason as the decoder: @noble/ed25519 comes in through a dynamic import
 * that would fail on a device that is already offline.
 */
export const warmUpVerifier = async () => {
  try {
    await crypto.subtle.importKey(
      'raw', new Uint8Array(32), { name: 'Ed25519' }, false, ['verify'],
    );
    return 'webcrypto';
  } catch (error) {
    await loadNoble();
    return 'noble';
  }
};

/** Pull the fields out of a QR without checking the signature. */
export const readQrClaims = (qrData) => {
  const data = (qrData || '').trim();
  const empty = {
    ticketId: null, signed: false, service: '', reference: '',
    seat: '', departure: '', expires: '', malformed: false,
  };
  if (!data) {
    return { ...empty, malformed: true };
  }
  if (!data.startsWith(`${PREFIX}.`)) {
    let ticketId = data;
    const prefix = LEGACY_PREFIXES.find((p) => ticketId.startsWith(p));
    if (prefix) {
      ticketId = ticketId.slice(prefix.length);
    }
    return { ...empty, ticketId: ticketId || null };
  }
  const parts = data.split('.');
  if (parts.length !== 3) {
    return { ...empty, signed: true, malformed: true };
  }
  try {
    const payload = new TextDecoder().decode(b64urlToBytes(parts[1]));
    const fields = payload.split(SEPARATOR);
    return {
      ...empty,
      signed: true,
      ticketId: fields[0] || null,
      service: fields[1] || '',
      reference: fields[2] || '',
      seat: fields[3] || '',
      departure: fields[4] || '',
      expires: fields[5] || '',
    };
  } catch (error) {
    return { ...empty, signed: true, malformed: true };
  }
};

/**
 * Decide, with no network, whether a scanned QR may pass.
 *
 * Applies the three offline conditions: the signature checks out, the ticket is
 * in the manifest for this trip, and this device has not already scanned it.
 *
 * Returns { ok, status, message, ticketId, holder, ticketType }, where status is
 * one of: valid, forged, expired, unknown, already_used, already_scanned_here,
 * unsigned, no_manifest.
 */
export const verifyOffline = async ({ qrData, manifest, alreadyScannedIds = [] }) => {
  const claims = readQrClaims(qrData);
  const base = { ticketId: claims.ticketId, holder: '', ticketType: '' };

  if (claims.malformed) {
    return { ...base, ok: false, status: 'forged', message: 'QR code illisible' };
  }

  if (claims.signed) {
    if (!manifest || !manifest.public_key) {
      return {
        ...base, ok: false, status: 'no_manifest',
        message: 'Manifeste absent : impossible de verifier hors ligne',
      };
    }
    const parts = qrData.trim().split('.');
    const payload = b64urlToBytes(parts[1]);
    const signature = b64urlToBytes(parts[2]);
    const publicKey = b64urlToBytes(manifest.public_key);
    const genuine = await verifySignature(signature, payload, publicKey);
    if (!genuine) {
      return { ...base, ok: false, status: 'forged', message: 'Billet non authentique' };
    }
    if (claims.expires && claims.expires < new Date().toISOString().slice(0, 10)) {
      return {
        ...base, ok: false, status: 'expired',
        message: `Billet expire depuis le ${claims.expires}`,
      };
    }
  }

  if (!manifest) {
    return {
      ...base, ok: false, status: 'no_manifest',
      message: 'Manifeste absent : telechargez-le avant le depart',
    };
  }

  const entry = (manifest.tickets || []).find((t) => t.ticket_id === claims.ticketId);
  if (!entry) {
    return {
      ...base, ok: false, status: 'unknown',
      message: 'Billet absent de ce trajet',
    };
  }

  const found = { ...base, holder: entry.holder || '', ticketType: entry.ticket_type || '' };

  if (alreadyScannedIds.includes(claims.ticketId)) {
    return {
      ...found, ok: false, status: 'already_scanned_here',
      message: 'Deja scanne sur cet appareil',
    };
  }
  if (entry.status === 'used') {
    return {
      ...found, ok: false, status: 'already_used',
      message: 'Billet deja utilise avant le depart',
    };
  }

  const message = claims.signed
    ? 'Billet valide (verifie hors ligne)'
    : 'Billet valide (ancien format, non signe)';
  return { ...found, ok: true, status: claims.signed ? 'valid' : 'unsigned', message };
};
