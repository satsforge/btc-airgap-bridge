/**
 * Single source of truth for every user-facing string. Same dictionary/
 * walker pattern as paper-wallet-btc, my-wallet-btc and psbt-signer-btc,
 * scoped to this tool's own screens.
 */
export const LANGS = ['es', 'en'];
export const DEFAULT_LANG = 'es';

const dict = {
  'meta.title': { es: 'BTC Airgap Bridge', en: 'BTC Airgap Bridge' },
  'topbar.brand': { es: 'BTC Airgap Bridge', en: 'BTC Airgap Bridge' },
  'topbar.theme.toLight': { es: '☀ Modo claro', en: '☀ Light mode' },
  'topbar.theme.toDark': { es: '🌙 Modo oscuro', en: '🌙 Dark mode' },
  'topbar.lang.toEnglish': { es: '🌐 English', en: '🌐 English' },
  'topbar.lang.toSpanish': { es: '🌐 Español', en: '🌐 Español' },

  'notice.warning': {
    es: '<strong>Que es esto:</strong> el puente online de un flujo air-gapped. No pide, no ve ni guarda ninguna clave privada — solo consulta UTXOs y tarifas de red, y transmite una transaccion que vos ya firmaste en otro lado (por ejemplo <strong>PSBT Signer BTC</strong> o una hardware wallet). Transmitir es irreversible: revisa siempre los destinos y montos antes de confirmar. Nadie ajeno a este proyecto audito el codigo todavia.',
    en: '<strong>What this is:</strong> the online bridge for an air-gapped workflow. It never asks for, sees, or stores any private key — it only queries UTXOs and network fees, and broadcasts a transaction you already signed elsewhere (for example <strong>PSBT Signer BTC</strong> or a hardware wallet). Broadcasting is irreversible: always review destinations and amounts before confirming. Nobody outside this project has audited the code yet.',
  },

  'network.legend': { es: 'Red', en: 'Network' },
  'network.testnet.label': { es: 'Testnet (recomendado para probar)', en: 'Testnet (recommended for testing)' },
  'network.mainnet.label': { es: 'Mainnet (Bitcoin real)', en: 'Mainnet (real Bitcoin)' },
  'network.mainnet.confirm': {
    es: 'Entiendo que voy a operar con Bitcoin real y puedo perder mis fondos si me equivoco.',
    en: 'I understand I am operating with real Bitcoin and can lose my funds if I make a mistake.',
  },
  'network.badge.testnet': { es: 'TESTNET', en: 'TESTNET' },
  'network.badge.mainnet': { es: 'MAINNET', en: 'MAINNET' },

  'fileLoad.button': { es: '📁 Cargar desde archivo', en: '📁 Load from file' },
  'error.fileReadFailed': { es: 'No se pudo leer el archivo: {msg}', en: 'Could not read the file: {msg}' },

  'utxos.title': { es: 'Obtener UTXOs y tarifas de red', en: 'Fetch UTXOs and network fees' },
  'utxos.hint': {
    es: 'Pega una o mas direcciones (una por linea) de tu wallet air-gapped. Se consulta cada una contra mempool.space y se junta todo en una sola lista de UTXOs, lista para llevar a tu firmador offline.',
    en: 'Paste one or more addresses (one per line) from your air-gapped wallet. Each one is queried against mempool.space and merged into a single UTXO list, ready to take to your offline signer.',
  },
  'utxos.address.label': { es: 'Direcciones', en: 'Addresses' },
  'utxos.query': { es: 'Consultar', en: 'Query' },
  'utxos.querying': { es: 'Consultando...', en: 'Querying...' },
  'utxos.progress': { es: 'Consultando direccion {n} de {total}: {address}', en: 'Querying address {n} of {total}: {address}' },
  'error.utxosFailed': { es: 'No se pudo consultar la red: {msg}', en: 'Could not query the network: {msg}' },

  'utxos.results.title': { es: 'Resultado', en: 'Result' },
  'utxos.fee.title': { es: 'Tarifas de red actuales', en: 'Current network fees' },
  'utxos.fee.fast': { es: 'Rapida (~1 bloque)', en: 'Fast (~1 block)' },
  'utxos.fee.medium': { es: 'Media (~1 hora)', en: 'Medium (~1 hour)' },
  'utxos.fee.economy': { es: 'Economica (~1 dia)', en: 'Economy (~1 day)' },
  'utxos.fee.unit': { es: 'sats/vB', en: 'sats/vB' },
  'utxos.fee.unknown': { es: 's/d', en: 'n/a' },
  'utxos.height.label': { es: 'Altura de bloque actual', en: 'Current block height' },
  'utxos.balance.label': { es: 'Saldo total consultado', en: 'Total balance queried' },
  'utxos.list.title': { es: 'UTXOs', en: 'UTXOs' },
  'utxos.list.empty': { es: 'Ninguna de estas direcciones tiene UTXOs sin gastar.', en: 'None of these addresses have any unspent outputs.' },
  'utxos.download': { es: '⬇ Descargar UTXOs (.json)', en: '⬇ Download UTXOs (.json)' },

  'broadcast.title': { es: 'Transmitir una transaccion ya firmada', en: 'Broadcast an already-signed transaction' },
  'broadcast.hint': {
    es: 'Pega o carga la transaccion firmada (hex) o el PSBT ya finalizado (base64 o hex) que trajiste de tu firmador offline. Esta herramienta nunca firma nada — solo decodifica lo que ya esta firmado y lo transmite.',
    en: 'Paste or load the signed transaction (hex) or the finalized PSBT (base64 or hex) you brought back from your offline signer. This tool never signs anything - it only decodes what is already signed and broadcasts it.',
  },
  'broadcast.label': { es: 'Transaccion firmada (hex) o PSBT finalizado', en: 'Signed transaction (hex) or finalized PSBT' },
  'broadcast.decode': { es: 'Decodificar', en: 'Decode' },
  'error.decodeFailed': { es: 'No se pudo decodificar: {msg}', en: 'Could not decode: {msg}' },

  'broadcast.review.title': { es: 'Revisar antes de transmitir', en: 'Review before broadcasting' },
  'broadcast.review.txid': { es: 'TXID (una vez transmitida)', en: 'TXID (once broadcast)' },
  'broadcast.review.vsize': { es: 'Tamano virtual', en: 'Virtual size' },
  'broadcast.review.outputsTotal': { es: 'Total de salidas', en: 'Total outputs' },
  'broadcast.review.fee': { es: 'Comision', en: 'Fee' },
  'broadcast.review.feeUnknown': {
    es: 'desconocida (no consultaste esos UTXOs en esta sesion)',
    en: 'unknown (those UTXOs were not queried in this session)',
  },
  'broadcast.review.outputs': { es: 'Salidas', en: 'Outputs' },
  'broadcast.review.noAddress': { es: '(script sin direccion estandar)', en: '(non-standard script)' },
  'broadcast.review.confirm': {
    es: 'Revise los destinos y los montos, y quiero transmitir esta transaccion a la red. Entiendo que no se puede deshacer.',
    en: 'I reviewed the destinations and amounts, and I want to broadcast this transaction to the network. I understand this cannot be undone.',
  },
  'broadcast.review.send': { es: 'Transmitir', en: 'Broadcast' },
  'broadcast.review.cancel': { es: 'Cancelar', en: 'Cancel' },
  'error.sendFailed': { es: 'No se pudo transmitir: {msg}', en: 'Could not broadcast: {msg}' },

  'broadcast.result.title': { es: 'Transaccion transmitida', en: 'Transaction broadcast' },
  'broadcast.result.hint': {
    es: 'Ya esta en la red. Podes seguir su confirmacion en el explorador.',
    en: 'It is now on the network. You can track its confirmation in the explorer.',
  },
  'broadcast.result.txid': { es: 'TXID', en: 'TXID' },
  'broadcast.result.link': { es: 'Ver en mempool.space', en: 'View on mempool.space' },
  'broadcast.result.copy': { es: 'Copiar TXID', en: 'Copy TXID' },
  'broadcast.result.copied': { es: 'Copiado!', en: 'Copied!' },
  'broadcast.result.another': { es: 'Transmitir otra', en: 'Broadcast another' },

  'footer.note': {
    es: 'Consulta UTXOs y transmite 100% desde tu navegador · sin cookies · sin almacenamiento persistente · ninguna clave privada pasa por aca. Revisa el codigo fuente antes de confiarle una transmision real.',
    en: 'Queries UTXOs and broadcasts 100% from your browser · no cookies · no persistent storage · no private key ever passes through here. Review the source before trusting it with a real broadcast.',
  },
};

export function t(key, lang, vars) {
  const entry = dict[key];
  let str = entry ? (entry[lang] ?? entry[DEFAULT_LANG]) : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v));
  }
  return str;
}
