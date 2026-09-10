import * as btc from '@scure/btc-signer';
import { base64, hex } from '@scure/base';

// PSBT magic bytes: ASCII "psbt" + 0xff separator (BIP174).
const PSBT_MAGIC = [0x70, 0x73, 0x62, 0x74, 0xff];

function looksLikePsbt(bytes) {
  if (bytes.length < PSBT_MAGIC.length) return false;
  return PSBT_MAGIC.every((b, i) => bytes[i] === b);
}

function decodeBytes(text) {
  const trimmed = text.replace(/\s+/g, '');
  if (!trimmed) throw new Error('Pega o carga la transaccion firmada primero.');

  // Hex and base64 alphabets overlap (any hex string also looks like valid
  // base64), so decoding successfully isn't proof of the right encoding -
  // try the encoding the string looks most like first, fall back to the other.
  const looksHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;
  const encodings = looksHex ? ['hex', 'base64'] : ['base64', 'hex'];

  let lastError = null;
  for (const encoding of encodings) {
    try {
      return encoding === 'hex' ? hex.decode(trimmed) : base64.decode(trimmed);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`No se pudo decodificar (ni base64 ni hex valido): ${lastError?.message ?? ''}`);
}

/**
 * Accepts either a raw finalized transaction (the usual output of an
 * air-gapped signer or hardware wallet) or a fully-finalized PSBT (base64 or
 * hex, either encoding). Rejects anything that still needs more signatures -
 * this tool only ever broadcasts, it never signs.
 */
export function decodeSignedInput(text) {
  const bytes = decodeBytes(text);

  if (looksLikePsbt(bytes)) {
    let tx;
    try {
      tx = btc.Transaction.fromPSBT(bytes, { allowUnknown: true });
    } catch (err) {
      throw new Error(`No se pudo leer el PSBT: ${err.message}`);
    }
    if (!tx.isFinal) {
      throw new Error(
        'Este PSBT todavia no esta firmado/finalizado del todo. Terminalo en tu firmador offline (por ejemplo PSBT Signer BTC) antes de transmitirlo.'
      );
    }
    return { tx, source: 'psbt' };
  }

  let tx;
  try {
    tx = btc.Transaction.fromRaw(bytes, {
      allowUnknownInputs: true,
      allowUnknownOutputs: true,
      allowUnknownVersion: true,
      disableScriptCheck: true,
    });
  } catch (err) {
    throw new Error(`No se pudo interpretar como PSBT finalizado ni como transaccion en crudo: ${err.message}`);
  }
  if (!tx.isFinal) {
    throw new Error('Esta transaccion no tiene firmas (scriptSig/witness vacios) - no hay nada para transmitir todavia.');
  }
  return { tx, source: 'raw' };
}

function scriptToAddress(script, network) {
  try {
    return btc.Address(network).encode(btc.OutScript.decode(script));
  } catch {
    return null;
  }
}

// A finalized PSBT may still carry witnessUtxo/nonWitnessUtxo metadata per
// input; a plain raw transaction never does (raw tx bytes have no concept of
// "previous output"). Mirrors psbt-signer-btc's own prevoutFor helper.
function prevoutFor(input) {
  if (input.witnessUtxo) return input.witnessUtxo;
  if (input.nonWitnessUtxo) {
    const raw = input.nonWitnessUtxo;
    const decoded =
      raw instanceof Uint8Array
        ? btc.RawTx.decode(raw)
        : typeof raw === 'string'
          ? btc.RawTx.decode(hex.decode(raw))
          : raw;
    return decoded.outputs[input.index];
  }
  return null;
}

/**
 * Human-readable summary for the mandatory review-before-broadcast screen.
 * `utxoIndex` (from network.js's fetchUtxosForAddresses, "txid:vout" ->
 * {amount, address}) is optional: if this session already queried the UTXOs
 * a raw transaction spends, the fee can be shown; otherwise it's reported as
 * unknown rather than guessed.
 */
export function describeTx(tx, network, utxoIndex) {
  const inputs = [];
  let inputsTotal = 0n;
  let allInputsKnown = true;
  for (let i = 0; i < tx.inputsLength; i++) {
    const input = tx.getInput(i);
    const txid = input.txid ? hex.encode(input.txid) : null;
    const vout = input.index ?? null;
    let amount = null;
    let address = null;
    const prevout = prevoutFor(input);
    if (prevout) {
      amount = prevout.amount;
      address = scriptToAddress(prevout.script, network);
    } else if (utxoIndex && txid !== null && vout !== null) {
      const hit = utxoIndex.get(`${txid}:${vout}`);
      if (hit) {
        amount = hit.amount;
        address = hit.address;
      }
    }
    if (amount === null) allInputsKnown = false;
    else inputsTotal += amount;
    inputs.push({ txid, vout, amount, address });
  }

  let outputsTotal = 0n;
  const outputs = [];
  for (let i = 0; i < tx.outputsLength; i++) {
    const output = tx.getOutput(i);
    outputsTotal += output.amount;
    outputs.push({ amount: output.amount, address: scriptToAddress(output.script, network) });
  }

  return {
    txid: tx.id,
    hex: tx.hex,
    vsize: tx.vsize,
    inputs,
    outputs,
    outputsTotal,
    inputsTotal: allInputsKnown ? inputsTotal : null,
    fee: allInputsKnown ? inputsTotal - outputsTotal : null,
  };
}
