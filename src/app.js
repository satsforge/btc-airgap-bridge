import * as btc from '@scure/btc-signer';
import QRCode from 'qrcode';
import { createProvider, btcNetwork, fetchFeeEstimates, fetchUtxosForAddresses } from './lib/network.js';
import { parseAddressList } from './lib/addressvalidate.js';
import { decodeSignedInput, describeTx } from './lib/txdecode.js';
import { t, DEFAULT_LANG } from './lib/i18n.js';

const $ = (id) => document.getElementById(id);

const state = {
  isTestnet: true,
  network: btcNetwork(true),
  lang: DEFAULT_LANG,
  lastUtxoIndex: null, // "txid:vout" -> {amount, address}, from the most recent UTXO query
  pendingTx: null, // {tx, source, summary}, awaiting broadcast confirmation
};

function tr(key, vars) {
  return t(key, state.lang, vars);
}

function fmtBtc(sats) {
  return btc.Decimal.encode(sats);
}

function fmtAddress(address) {
  if (!address) return tr('broadcast.review.noAddress');
  return address.length > 20 ? `${address.slice(0, 10)}…${address.slice(-8)}` : address;
}

function setError(elId, message) {
  const el = $(elId);
  el.textContent = message ?? '';
  el.hidden = !message;
}

function explorerBase() {
  return state.isTestnet ? 'https://mempool.space/testnet' : 'https://mempool.space';
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Topbar: language / theme ----------

function updateThemeButtonLabel() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  $('theme-toggle').textContent = tr(isLight ? 'topbar.theme.toDark' : 'topbar.theme.toLight');
}

function updateLangButtonLabel() {
  $('lang-toggle').textContent = tr(state.lang === 'es' ? 'topbar.lang.toEnglish' : 'topbar.lang.toSpanish');
}

function updateNetworkBadge() {
  const badge = $('network-badge');
  badge.textContent = tr(state.isTestnet ? 'network.badge.testnet' : 'network.badge.mainnet');
  badge.classList.toggle('badge-testnet', state.isTestnet);
  badge.classList.toggle('badge-mainnet', !state.isTestnet);
}

function applyTranslations() {
  document.documentElement.lang = state.lang;
  document.title = tr('meta.title');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.innerHTML = tr(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.setAttribute('placeholder', tr(el.dataset.i18nPlaceholder)); });

  updateThemeButtonLabel();
  updateLangButtonLabel();
  updateNetworkBadge();
}

function initTopbar() {
  $('lang-toggle').addEventListener('click', () => {
    state.lang = state.lang === 'es' ? 'en' : 'es';
    applyTranslations();
  });

  $('theme-toggle').addEventListener('click', () => {
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
    updateThemeButtonLabel();
  });
}

// ---------- Network choice ----------

function initNetworkChoice() {
  const mainnetRadio = $('network-mainnet');
  const testnetRadio = $('network-testnet');
  const mainnetConfirm = $('mainnet-confirm-wrap');
  const mainnetConfirmCheckbox = $('mainnet-confirm-checkbox');

  function syncNetworkUI() {
    mainnetConfirm.hidden = !mainnetRadio.checked;
    const blocked = mainnetRadio.checked && !mainnetConfirmCheckbox.checked;
    $('utxos-query-btn').disabled = blocked;
    if (state.pendingTx) $('confirm-send-btn').disabled = blocked || !$('review-confirm-checkbox').checked;
    state.isTestnet = testnetRadio.checked;
    state.network = btcNetwork(state.isTestnet);
    updateNetworkBadge();
  }
  mainnetRadio.addEventListener('change', syncNetworkUI);
  testnetRadio.addEventListener('change', syncNetworkUI);
  mainnetConfirmCheckbox.addEventListener('change', syncNetworkUI);
  syncNetworkUI();
}

// ---------- UTXOs + fees ----------

function wireFileLoad(buttonId, fileInputId, targetId, errorId) {
  const button = $(buttonId);
  const fileInput = $(fileInputId);
  button.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      $(targetId).value = text.trim();
    } catch (err) {
      setError(errorId, tr('error.fileReadFailed', { msg: err.message }));
    }
  });
}

function renderUtxoResults({ fees, height, utxos }) {
  $('fee-fast').textContent = fees.fast !== null ? `${fees.fast} ${tr('utxos.fee.unit')}` : tr('utxos.fee.unknown');
  $('fee-medium').textContent = fees.medium !== null ? `${fees.medium} ${tr('utxos.fee.unit')}` : tr('utxos.fee.unknown');
  $('fee-economy').textContent = fees.economy !== null ? `${fees.economy} ${tr('utxos.fee.unit')}` : tr('utxos.fee.unknown');

  $('utxos-height').textContent = String(height);
  const total = utxos.reduce((sum, u) => sum + u.amount, 0n);
  $('utxos-balance').textContent = `${fmtBtc(total)} BTC`;

  const list = $('utxos-list');
  list.innerHTML = '';
  if (!utxos.length) {
    const li = document.createElement('li');
    li.className = 'list-empty';
    li.textContent = tr('utxos.list.empty');
    list.appendChild(li);
  } else {
    for (const u of utxos) {
      const li = document.createElement('li');
      li.className = 'utxo-row';
      li.innerHTML = `
        <span class="utxo-outpoint">${u.txid.slice(0, 10)}…${u.txid.slice(-6)}:${u.vout}<span class="utxo-address">${fmtAddress(u.address)}</span></span>
        <span class="utxo-amount">${fmtBtc(u.amount)} BTC</span>
      `;
      list.appendChild(li);
    }
  }

  $('utxos-results').hidden = false;
}

function initUtxosPanel() {
  wireFileLoad('address-file-btn', 'address-file-input', 'address-input', 'utxos-error');

  $('utxos-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setError('utxos-error', null);
    $('utxos-results').hidden = true;
    const btnEl = $('utxos-query-btn');
    const progressEl = $('utxos-progress');
    btnEl.disabled = true;
    progressEl.hidden = false;
    progressEl.textContent = tr('utxos.querying');
    try {
      const addresses = parseAddressList($('address-input').value, state.network);
      const provider = createProvider(state.isTestnet);
      const [{ utxos, index }, fees, height] = await Promise.all([
        fetchUtxosForAddresses(provider, addresses, ({ address, index: i, total }) => {
          progressEl.textContent = tr('utxos.progress', { n: i + 1, total, address: fmtAddress(address) });
        }),
        fetchFeeEstimates(provider),
        provider.height(),
      ]);
      state.lastUtxoIndex = index;
      renderUtxoResults({ fees, height, utxos });
      $('utxos-download-btn').onclick = () => {
        downloadText(
          `utxos-${state.isTestnet ? 'testnet' : 'mainnet'}.json`,
          JSON.stringify(
            { network: state.isTestnet ? 'testnet' : 'mainnet', height, fees, utxos: utxos.map((u) => ({ ...u, amount: u.amount.toString() })) },
            null,
            2
          )
        );
      };
    } catch (err) {
      setError('utxos-error', tr('error.utxosFailed', { msg: err.message }));
    } finally {
      progressEl.hidden = true;
      btnEl.disabled = $('network-mainnet').checked && !$('mainnet-confirm-checkbox').checked;
    }
  });
}

// ---------- Broadcast ----------

function renderBroadcastReview(summary) {
  $('review-txid').textContent = summary.txid;
  $('review-vsize').textContent = `${summary.vsize} vB`;
  $('review-outputs-total').textContent = `${fmtBtc(summary.outputsTotal)} BTC`;
  $('review-fee').textContent = summary.fee !== null ? `${fmtBtc(summary.fee)} BTC` : tr('broadcast.review.feeUnknown');

  const list = $('review-outputs');
  list.innerHTML = '';
  for (const output of summary.outputs) {
    const li = document.createElement('li');
    li.className = 'output-row';
    li.innerHTML = `
      <span class="output-address">${fmtAddress(output.address)}</span>
      <span class="output-amount">${fmtBtc(output.amount)} BTC</span>
    `;
    list.appendChild(li);
  }

  $('review-confirm-checkbox').checked = false;
  $('confirm-send-btn').disabled = true;
  setError('review-error', null);
  $('broadcast-review').hidden = false;
  $('broadcast-result').hidden = true;
}

async function renderBroadcastResult(txid) {
  $('result-txid').textContent = txid;
  const link = `${explorerBase()}/tx/${txid}`;
  $('result-link').href = link;

  const qr = $('result-qr');
  try {
    const dataUrl = await QRCode.toDataURL(link, { margin: 1, width: 240 });
    qr.src = dataUrl;
    qr.hidden = false;
  } catch {
    qr.hidden = true;
  }

  $('broadcast-review').hidden = true;
  $('broadcast-result').hidden = false;
}

function initBroadcastPanel() {
  wireFileLoad('signed-tx-file-btn', 'signed-tx-file-input', 'signed-tx-input', 'broadcast-error');

  $('broadcast-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    setError('broadcast-error', null);
    try {
      const { tx } = decodeSignedInput($('signed-tx-input').value);
      const summary = describeTx(tx, state.network, state.lastUtxoIndex);
      state.pendingTx = { tx, summary };
      $('signed-tx-input').value = '';
      renderBroadcastReview(summary);
    } catch (err) {
      setError('broadcast-error', tr('error.decodeFailed', { msg: err.message }));
    }
  });

  $('review-confirm-checkbox').addEventListener('change', (ev) => {
    const mainnetBlocked = $('network-mainnet').checked && !$('mainnet-confirm-checkbox').checked;
    $('confirm-send-btn').disabled = !ev.target.checked || mainnetBlocked;
  });

  $('cancel-review-btn').addEventListener('click', () => {
    state.pendingTx = null;
    $('broadcast-review').hidden = true;
  });

  $('confirm-send-btn').addEventListener('click', async () => {
    if (!state.pendingTx) return;
    setError('review-error', null);
    $('confirm-send-btn').disabled = true;
    try {
      const provider = createProvider(state.isTestnet);
      const txid = await provider.sendTx(state.pendingTx.summary.hex);
      state.pendingTx = null;
      await renderBroadcastResult(txid);
    } catch (err) {
      setError('review-error', tr('error.sendFailed', { msg: err.message }));
      $('confirm-send-btn').disabled = false;
    }
  });

  $('result-copy-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('result-txid').textContent);
      const btnEl = $('result-copy-btn');
      btnEl.textContent = tr('broadcast.result.copied');
      setTimeout(() => { btnEl.textContent = tr('broadcast.result.copy'); }, 1500);
    } catch { /* clipboard may be unavailable; text is selectable regardless */ }
  });

  $('result-another-btn').addEventListener('click', () => {
    $('broadcast-result').hidden = true;
    setError('broadcast-error', null);
  });
}

// ---------- Boot ----------

function init() {
  initTopbar();
  initNetworkChoice();
  initUtxosPanel();
  initBroadcastPanel();
  applyTranslations();
}

init();
