import * as btc from '@scure/btc-signer';

/**
 * Parses a newline-separated address list, validating each one against the
 * chosen network (a mainnet address pasted while on testnet, or vice versa,
 * fails to decode here rather than silently being queried against the wrong
 * chain). Re-encodes every address to its canonical form and de-duplicates.
 */
export function parseAddressList(text, network) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    throw new Error('Pega al menos una direccion.');
  }
  const addr = btc.Address(network);
  const seen = new Set();
  const addresses = [];
  for (const line of lines) {
    let canonical;
    try {
      canonical = addr.encode(addr.decode(line));
    } catch {
      throw new Error(`Direccion invalida para esta red: ${line}`);
    }
    if (!seen.has(canonical)) {
      seen.add(canonical);
      addresses.push(canonical);
    }
  }
  return addresses;
}
