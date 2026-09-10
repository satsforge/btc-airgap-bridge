# BTC Airgap Bridge

Repo: [github.com/satsforge/btc-airgap-bridge](https://github.com/satsforge/btc-airgap-bridge)

El puente **online** de un flujo de trabajo con billetera fría (air-gapped).
No pide, no ve ni guarda ninguna clave privada — de hecho no tiene ningún
concepto de clave en absoluto, ni siquiera pública. Solo hace dos cosas:

1. **Consultar UTXOs y tarifas de red** para una o mas direcciones, para que
   tu wallet air-gapped (o hardware wallet, o [PSBT Signer BTC](../psbt-signer-btc))
   pueda armar y firmar una transacción sin necesitar internet.
2. **Transmitir una transacción que ya firmaste en otro lado** — pegás el hex
   firmado (o un PSBT ya finalizado) y esta herramienta lo decodifica, te
   muestra un resumen para revisar, y lo transmite a la red.

El entregable es un único archivo `index.html` autocontenido, igual en
espíritu a las otras herramientas de este mismo grupo
([`paper-wallet-btc`](../paper-wallet-btc), [`my_btc_wallet`](../my_btc_wallet),
[`psbt-signer-btc`](../psbt-signer-btc)), pero con un rol distinto: a
diferencia de esas tres, esta herramienta **nunca firma nada** y **siempre
necesita red** — es, a propósito, la única mitad "online" de un flujo que de
otro modo sería 100% air-gapped.

> ⚠️ **Aviso importante — proyecto sin auditoría externa todavía.**
> Transmite transacciones reales de Bitcoin a la red. Nadie ajeno a este
> repositorio auditó el código todavía. Es software "tal cual", sin
> garantía. **Probá primero en testnet.** Antes de confiarle una
> transmisión real en mainnet: leé el código fuente vos mismo, y revisá
> siempre el resumen (destinos, montos) antes de confirmar — transmitir es
> irreversible.

## Por qué existe

Un flujo air-gapped completo (wallet fría que nunca toca internet + firmador
offline como PSBT Signer BTC) necesita, en algún momento, tocar la red dos
veces: para saber qué UTXOs tiene disponibles y a qué tarifa conviene pagar
*antes* de armar la transacción, y para transmitirla *después* de firmarla.
Ninguna herramienta de este grupo cubría eso:

- `my_btc_wallet` en su modo watch-only arma un PSBT completo por vos, pero
  no expone los UTXOs en crudo ni transmite nada ajeno — solo lo que ella
  misma construyó.
- `psbt-signer-btc` firma, pero adrede **nunca hace ninguna llamada de red**
  (ni para consultar ni para transmitir) — esa es justamente su garantía de
  seguridad.

BTC Airgap Bridge llena ese hueco: es el complemento online mínimo para
cualquier firmador offline, no solo para PSBT Signer BTC — sirve igual para
una hardware wallet o cualquier otra herramienta que construya sus propias
transacciones a partir de una lista de UTXOs y una tarifa.

## Cómo usarlo

```bash
npm install
npm run build     # genera dist/index.html e index.html
```

Abrí `index.html` en un navegador moderno. A diferencia de sus hermanas, este
archivo sí necesita conexión a internet para funcionar — no tiene sentido
abrirlo en un equipo desconectado.

1. Elegí la red (Testnet por defecto; Mainnet exige tildar un checkbox de
   confirmación explícita, igual que en el resto del grupo).
2. **Obtener UTXOs y tarifas**: pegá una o más direcciones (una por línea) de
   tu wallet air-gapped. Se consulta cada una contra
   [mempool.space](https://mempool.space) y se combinan en una sola lista de
   UTXOs (con su monto y dirección de origen), junto con la altura de bloque
   actual y tres estimaciones de tarifa (rápida/media/económica, en
   sats/vB). Con **"Descargar UTXOs (.json)"** te llevás todo eso a tu
   firmador offline.
3. **Transmitir una transacción firmada**: pegá o cargá el hex de una
   transacción ya firmada (lo que exporta PSBT Signer BTC al finalizar), o un
   PSBT ya completamente finalizado en base64/hex. Se decodifica y se muestra
   un resumen — TXID que va a tener, tamaño virtual, salidas con dirección y
   monto, y la comisión (calculada de verdad si en esta misma sesión ya
   consultaste los UTXOs que esa transacción gasta; si no, se muestra
   honestamente como "desconocida" en vez de inventar un número). Con el
   checkbox de confirmación tildado, **"Transmitir"** hace el `POST /tx` a
   mempool.space y muestra el TXID final con un link al explorador.

## Modelo de seguridad

- **Cero claves, de ningún tipo**: esta herramienta no tiene ningún campo
  para pegar una clave privada, una semilla, ni siquiera una clave pública
  extendida (xpub). Solo entiende direcciones (para consultar) y
  transacciones ya firmadas (para transmitir). No hay nada que proteger en
  memoria porque no hay ningún secreto que gestionar.
- **Nunca firma**: `src/lib/txdecode.js` decodifica lo que se pega y
  verifica explícitamente que ya esté completamente firmado/finalizado
  (`tx.isFinal`) antes de aceptarlo. Un PSBT parcialmente firmado, o una
  transacción en crudo sin `scriptSig`/witness, se rechaza con un error
  claro en vez de intentar completarlo — esta herramienta transmite, no
  firma ni cosigna.
- **Fee mostrado con honestidad**: cuando se puede calcular la comisión real
  de una transacción a transmitir (porque el PSBT trae sus propios datos de
  UTXO, o porque esta misma sesión ya consultó esos UTXOs en el panel de
  arriba), se muestra el número exacto. Cuando no, se muestra explícitamente
  como "desconocida" — nunca se adivina ni se omite en silencio.
- **Pantalla de revisión obligatoria**: antes de transmitir se muestran
  todas las salidas (dirección + monto), el tamaño virtual y la comisión (si
  se pudo calcular), con un checkbox de confirmación explícito que advierte
  que transmitir es irreversible. No hay transmisión con un solo click.
- **Cero persistencia**: no se usa `localStorage`, `sessionStorage`, cookies
  ni IndexedDB.
- **CSP con red como excepción explícita, no un descuido**: a diferencia de
  `psbt-signer-btc` (`connect-src 'none'`, nunca toca la red) o de
  `my_btc_wallet` (`connect-src` restringido a mempool.space como excepción
  puntual a un modelo mayormente offline), en esta herramienta la red *es*
  el propósito — `script-src` sigue restringido a un hash SHA-256 del único
  bloque de script inline, pero `connect-src` apunta directamente a
  `https://mempool.space` porque sin eso la herramienta no tiene función.

## Diferencias con las otras herramientas del grupo

| | paper-wallet-btc | My Wallet BTC | PSBT Signer BTC | BTC Airgap Bridge |
|---|---|---|---|---|
| Red | Ninguna (air-gapped) | Sí | Ninguna (air-gapped) | Sí, siempre |
| Claves privadas | Genera | Importa y firma | Importa y firma | Nunca |
| Rol | Generar una wallet nueva | Wallet completa (o watch-only) | Firmar un PSBT offline | Consultar UTXOs/tarifas y transmitir |
| Salida | PDF imprimible | Envío directo o PSBT sin firmar | Hex firmado o PSBT parcial | UTXOs (.json) o TXID transmitido |

## Estructura del proyecto

```
src/
  lib/
    network.js          cliente Esplora (mempool.space) mainnet/testnet: UTXOs, tarifas, broadcast
    addressvalidate.js  parseo y validación de una lista de direcciones contra la red elegida
    txdecode.js          decodifica una tx firmada (hex) o un PSBT finalizado, arma el resumen de revisión
    i18n.js              diccionario ES/EN + walker data-i18n (mismo patrón que el resto del grupo)
  app.js                 controlador de la UI (sin frameworks)
  styles.css              tema oscuro/claro al estilo del resto del grupo
index.src.html            plantilla HTML fuente (placeholders __CSS__/__SCRIPT__/__CSP__)
build.mjs                 empaqueta todo en un único index.html autocontenido
test/                      tests (node:test)
```

## Tests

```bash
npm test
```

`addressvalidate.test.mjs` valida el parseo y la de-duplicación de listas de
direcciones, y que una dirección de la red equivocada (testnet pegada en
mainnet o viceversa) se rechace explícitamente.

`txdecode.test.mjs` construye una transacción P2WPKH real (funding falso +
gasto firmado con una clave aleatoria, igual que los tests de firma de
`psbt-signer-btc`) y verifica, contra ese round-trip real:

- que un hex de transacción en crudo y un PSBT finalizado (en base64 y en
  hex) se decodifiquen igual, con el mismo TXID;
- que un PSBT todavía no finalizado, y una transacción en crudo sin firmas,
  se rechacen con un error claro;
- que el resumen (`describeTx`) siempre pueda mostrar las salidas, pero solo
  calcule la comisión cuando el monto de las entradas es conocido (por datos
  de PSBT o por un índice de UTXOs consultado antes) — y que la reporte como
  desconocida en cualquier otro caso, en vez de inventarla.

Además, el flujo completo se probó a mano contra la red **testnet real** de
mempool.space (no solo con tests unitarios): se consultaron UTXOs y tarifas
reales de direcciones testnet activas (una con UTXOs, otra vacía, mezcladas
en una sola consulta), y se decodificó y se intentó transmitir una
transacción testnet real ya confirmada — el nodo la rechazó correctamente
con `"Transaction outputs already in utxo set"` (código -27), confirmando
que tanto la decodificación como el `POST /tx` funcionan contra la red real
de punta a punta.

## Limitaciones conocidas

- Depende de la disponibilidad de `mempool.space`. Si el servicio está
  caído, o una dirección tiene demasiados UTXOs sin gastar (algunas
  direcciones de faucets testnet superan el límite que Esplora permite
  listar), la consulta falla con el error que devuelve la API — no hay
  fallback a otro proveedor ni a un nodo propio configurable desde la UI.
- La comisión de una transacción a transmitir solo se puede calcular cuando
  el monto de sus entradas es conocido. Para una transacción en crudo (el
  caso más común, el hex que exporta PSBT Signer BTC al finalizar) eso
  requiere haber consultado esos mismos UTXOs en el panel de arriba durante
  la misma sesión; si no, la comisión se muestra como desconocida en vez de
  bloquear la transmisión — la decisión de confirmar igual queda en manos
  del usuario, que ya vio el resumen completo de salidas.
- No valida que las direcciones de las salidas sean las esperadas más allá
  de mostrarlas para revisión manual — no hay una lista de "direcciones
  propias" contra la cual comparar, porque esta herramienta no conoce
  ninguna clave ni xpub.
- Sin descarga/backup de nada persistente: es una herramienta de consulta y
  transmisión puntual, no un explorador de bloques ni un histórico de
  transacciones.

## Licencia

ISC — software "tal cual", sin garantía. Antes de confiarle una transmisión
real: leé el código fuente y probá primero en testnet.
