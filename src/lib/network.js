import { EsploraProvider } from '@scure/btc-signer/net.js';
import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';

const BASE_URL = {
  mainnet: 'https://mempool.space/api',
  testnet: 'https://mempool.space/testnet/api',
};

export function btcNetwork(isTestnet) {
  return isTestnet ? btc.TEST_NETWORK : btc.NETWORK;
}

export function createProvider(isTestnet) {
  const url = isTestnet ? BASE_URL.testnet : BASE_URL.mainnet;
  return new EsploraProvider(fetch.bind(globalThis), url, btcNetwork(isTestnet));
}

// Esplora fee-estimate confirmation targets shown to the user: next block,
// ~1 hour, ~1 day. Kept as a fixed set instead of the full curve - an
// air-gapped signer needs one sats/vB number to build with, not a table.
export const FEE_TARGETS = [
  { key: 'fast', target: 1 },
  { key: 'medium', target: 6 },
  { key: 'economy', target: 144 },
];

export async function fetchFeeEstimates(provider) {
  const entries = await Promise.all(
    FEE_TARGETS.map(async ({ key, target }) => {
      try {
        return [key, await provider.fee(target)];
      } catch {
        // A missing target (thin mempool, proxy quirks) must not fail the
        // whole panel - the other targets are still useful on their own.
        return [key, null];
      }
    })
  );
  return Object.fromEntries(entries);
}

/**
 * Fetches UTXOs for every address, one address at a time (deliberately
 * sequential - a burst of parallel requests is what triggers mempool.space's
 * rate limiting in practice). Returns the flat UTXO list plus an index keyed
 * "txid:vout" -> {amount, address} that the broadcast panel can use to show
 * a fee for a raw signed transaction spending these same UTXOs.
 */
export async function fetchUtxosForAddresses(provider, addresses, onProgress) {
  const utxos = [];
  const index = new Map();
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    if (onProgress) onProgress({ address, index: i, total: addresses.length });
    const { utxo } = await provider.unspent(address);
    for (const item of utxo) {
      const decoded = btc.RawTx.decode(item.nonWitnessUtxo);
      const output = decoded.outputs[item.index];
      const entry = {
        txid: item.txid,
        vout: item.index,
        amount: output.amount,
        address,
        scriptHex: hex.encode(output.script),
      };
      utxos.push(entry);
      index.set(`${entry.txid}:${entry.vout}`, { amount: entry.amount, address: entry.address });
    }
  }
  return { utxos, index };
}
