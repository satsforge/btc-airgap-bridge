import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as btc from '@scure/btc-signer';
import { hex, base64 } from '@scure/base';
import { randomBytes } from '@noble/hashes/utils.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { decodeSignedInput, describeTx } from '../src/lib/txdecode.js';

const network = btc.TEST_NETWORK;

function randomKeypair() {
  const privateKey = randomBytes(32);
  const publicKey = secp256k1.getPublicKey(privateKey, true);
  return { privateKey, publicKey };
}

function buildFundingTx(script, amount) {
  const funding = new btc.Transaction({ version: 1 });
  funding.addInput({ txid: new Uint8Array(32), index: 0xffffffff });
  funding.addOutput({ script, amount });
  return funding;
}

// Builds a finalized P2WPKH transaction spending one funding output, plus
// the "txid:vout" -> {amount, address} entry a UTXO query would have
// produced for it (used to exercise the optional fee-enrichment path).
function buildSignedFixture() {
  const source = randomKeypair();
  const sourceScript = btc.p2wpkh(source.publicKey, network).script;
  const sourceAddress = btc.p2wpkh(source.publicKey, network).address;
  const funding = buildFundingTx(sourceScript, 100_000n);

  const dest = randomKeypair();
  const destAddress = btc.p2wpkh(dest.publicKey, network).address;

  const tx = new btc.Transaction();
  tx.addInput({ txid: funding.id, index: 0, nonWitnessUtxo: funding.unsignedTx });
  tx.addOutputAddress(destAddress, 60_000n, network);
  tx.sign(source.privateKey);
  tx.finalize();

  const utxoIndex = new Map([[`${funding.id}:0`, { amount: 100_000n, address: sourceAddress }]]);
  return { tx, destAddress, utxoIndex };
}

test('decodes a raw finalized transaction hex', () => {
  const { tx } = buildSignedFixture();
  const { tx: decoded, source } = decodeSignedInput(tx.hex);
  assert.equal(source, 'raw');
  assert.equal(decoded.id, tx.id);
});

test('decodes a finalized PSBT in base64', () => {
  const { tx } = buildSignedFixture();
  const psbtB64 = base64.encode(tx.toPSBT());
  const { tx: decoded, source } = decodeSignedInput(psbtB64);
  assert.equal(source, 'psbt');
  assert.equal(decoded.id, tx.id);
});

test('decodes a finalized PSBT in hex too', () => {
  const { tx } = buildSignedFixture();
  const psbtHex = hex.encode(tx.toPSBT());
  const { tx: decoded, source } = decodeSignedInput(psbtHex);
  assert.equal(source, 'psbt');
  assert.equal(decoded.id, tx.id);
});

test('rejects a PSBT that is not finalized yet', () => {
  const source = randomKeypair();
  const sourceScript = btc.p2wpkh(source.publicKey, network).script;
  const funding = buildFundingTx(sourceScript, 100_000n);
  const tx = new btc.Transaction();
  tx.addInput({ txid: funding.id, index: 0, nonWitnessUtxo: funding.unsignedTx });
  tx.addOutputAddress(btc.p2wpkh(randomKeypair().publicKey, network).address, 60_000n, network);
  // Not signed, not finalized.
  const unsignedPsbt = base64.encode(tx.toPSBT());
  assert.throws(() => decodeSignedInput(unsignedPsbt), /todavia no esta firmado/);
});

test('rejects an unsigned raw transaction (no scriptSig/witness)', () => {
  const source = randomKeypair();
  const sourceScript = btc.p2wpkh(source.publicKey, network).script;
  const funding = buildFundingTx(sourceScript, 100_000n);
  const tx = new btc.Transaction();
  tx.addInput({ txid: funding.id, index: 0, nonWitnessUtxo: funding.unsignedTx });
  tx.addOutputAddress(btc.p2wpkh(randomKeypair().publicKey, network).address, 60_000n, network);
  assert.throws(() => decodeSignedInput(hex.encode(tx.unsignedTx)), /no tiene firmas/);
});

test('rejects garbage input', () => {
  assert.throws(() => decodeSignedInput('not a transaction'), /No se pudo decodificar/);
});

test('rejects empty input', () => {
  assert.throws(() => decodeSignedInput(''), /Pega o carga/);
});

test('describeTx reports outputs always, and fee only when inputs are known', () => {
  // Mirrors the real path: decode from raw hex, the same way a pasted
  // signed transaction arrives - a plain raw tx carries no prevout amounts
  // at all, unlike the in-memory Transaction object still holding onto the
  // nonWitnessUtxo it was built with.
  const { tx, destAddress } = buildSignedFixture();
  const { tx: decoded } = decodeSignedInput(tx.hex);
  const withoutIndex = describeTx(decoded, network, null);
  assert.equal(withoutIndex.outputs.length, 1);
  assert.equal(withoutIndex.outputs[0].address, destAddress);
  assert.equal(withoutIndex.outputs[0].amount, 60_000n);
  assert.equal(withoutIndex.fee, null);
  assert.equal(withoutIndex.inputsTotal, null);
});

test('describeTx computes a real fee once the spent UTXO is known', () => {
  const { tx, utxoIndex } = buildSignedFixture();
  const { tx: decoded } = decodeSignedInput(tx.hex);
  const summary = describeTx(decoded, network, utxoIndex);
  assert.equal(summary.inputsTotal, 100_000n);
  assert.equal(summary.outputsTotal, 60_000n);
  assert.equal(summary.fee, 40_000n);
  assert.equal(summary.txid, tx.id);
  assert.ok(summary.vsize > 0);
});

test('describeTx also finds the fee directly from a finalized PSBT that still carries prevout data', () => {
  const { tx } = buildSignedFixture();
  const psbtB64 = base64.encode(tx.toPSBT());
  const { tx: decoded } = decodeSignedInput(psbtB64);
  const summary = describeTx(decoded, network, null);
  assert.equal(summary.inputsTotal, 100_000n);
  assert.equal(summary.fee, 40_000n);
});
