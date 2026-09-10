import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as btc from '@scure/btc-signer';
import { parseAddressList } from '../src/lib/addressvalidate.js';

const MAINNET_BECH32 = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const TESTNET_BECH32 = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
const MAINNET_LEGACY = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';

test('parses a single valid mainnet address', () => {
  const [addr] = parseAddressList(MAINNET_BECH32, btc.NETWORK);
  assert.equal(addr, MAINNET_BECH32);
});

test('parses multiple addresses, one per line, de-duplicating', () => {
  const text = `${MAINNET_BECH32}\n${MAINNET_LEGACY}\n${MAINNET_BECH32}\n`;
  const list = parseAddressList(text, btc.NETWORK);
  assert.deepEqual(list, [MAINNET_BECH32, MAINNET_LEGACY]);
});

test('rejects a testnet address when mainnet is expected', () => {
  assert.throws(() => parseAddressList(TESTNET_BECH32, btc.NETWORK), /Direccion invalida/);
});

test('accepts a testnet address against the testnet network', () => {
  const [addr] = parseAddressList(TESTNET_BECH32, btc.TEST_NETWORK);
  assert.equal(addr, TESTNET_BECH32);
});

test('rejects garbage input', () => {
  assert.throws(() => parseAddressList('not an address', btc.NETWORK), /Direccion invalida/);
});

test('rejects empty input', () => {
  assert.throws(() => parseAddressList('   \n  \n', btc.NETWORK), /Pega al menos/);
});
