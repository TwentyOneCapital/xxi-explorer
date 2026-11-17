import config from '../../config';
import Client from '@mempool/electrum-client';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import { IEsploraApi } from './esplora-api.interface';
import { IElectrumApi } from './electrum-api.interface';
import BitcoinApi from './bitcoin-api';
import logger from '../../logger';
import crypto from 'crypto-js';
import loadingIndicators from '../loading-indicators';
import memoryCache from '../memory-cache';

class BitcoindElectrsApi extends BitcoinApi implements AbstractBitcoinApi {
  private electrumClient: any;

  constructor(bitcoinClient: any) {
    super(bitcoinClient);

    const electrumConfig = { client: 'mempool-v2', version: '1.4' };
    const electrumPersistencePolicy = { retryPeriod: 1000, maxRetry: Number.MAX_SAFE_INTEGER, callback: null };

    const electrumCallbacks = {
      onConnect: (client, versionInfo) => { logger.info(`Connected to Electrum Server at ${config.ELECTRUM.HOST}:${config.ELECTRUM.PORT} (${JSON.stringify(versionInfo)})`); },
      onClose: (client) => { logger.info(`Disconnected from Electrum Server at ${config.ELECTRUM.HOST}:${config.ELECTRUM.PORT}`); },
      onError: (err) => { logger.err(`Electrum error: ${JSON.stringify(err)}`); },
      onLog: (str) => { logger.debug(str); },
    };

    this.electrumClient = new Client(
      config.ELECTRUM.PORT,
      config.ELECTRUM.HOST,
      config.ELECTRUM.TLS_ENABLED ? 'tls' : 'tcp',
      null,
      electrumCallbacks
    );

    this.electrumClient.initElectrum(electrumConfig, electrumPersistencePolicy)
      .then(() => { })
      .catch((err) => {
        logger.err(`Error connecting to Electrum Server at ${config.ELECTRUM.HOST}:${config.ELECTRUM.PORT}`);
      });
  }

  /** @asyncUnsafe */
  async $getAddress(address: string): Promise<IEsploraApi.Address> {
    const addressInfo = await this.bitcoindClient.validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
      throw new Error('Invalid Bitcoin address');
    }

    try {
      const balance = await this.$getScriptHashBalance(addressInfo.scriptPubKey);
      const history = await this.$getScriptHashHistory(addressInfo.scriptPubKey);

      const unconfirmed = history.filter((h) => h.fee).length;

      return {
        'address': addressInfo.address,
        'chain_stats': {
          'funded_txo_count': 0,
          'funded_txo_sum': balance.confirmed ? balance.confirmed : 0,
          'spent_txo_count': 0,
          'spent_txo_sum': balance.confirmed < 0 ? balance.confirmed : 0,
          'tx_count': history.length - unconfirmed,
        },
        'mempool_stats': {
          'funded_txo_count': 0,
          'funded_txo_sum': balance.unconfirmed > 0 ? balance.unconfirmed : 0,
          'spent_txo_count': 0,
          'spent_txo_sum': balance.unconfirmed < 0 ? -balance.unconfirmed : 0,
          'tx_count': unconfirmed,
        },
        'electrum': true,
      };
    } catch (e: any) {
      throw new Error(typeof e === 'string' ? e : e && e.message || e);
    }
  }

  /** @asyncUnsafe */
  async $getAddressTransactions(address: string, lastSeenTxId: string): Promise<IEsploraApi.Transaction[]> {
    const addressInfo = await this.bitcoindClient.validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
      throw new Error('Invalid Bitcoin address');
    }

    try {
      loadingIndicators.setProgress('address-' + address, 0);

      const transactions: IEsploraApi.Transaction[] = [];
      const history = await this.$getScriptHashHistory(addressInfo.scriptPubKey);
      history.sort((a, b) => (b.height || 9999999) - (a.height || 9999999));

      let startingIndex = 0;
      if (lastSeenTxId) {
        const pos = history.findIndex((historicalTx) => historicalTx.tx_hash === lastSeenTxId);
        if (pos) {
          startingIndex = pos + 1;
        }
      }
      const endIndex = Math.min(startingIndex + 10, history.length);

      for (let i = startingIndex; i < endIndex; i++) {
        const tx = await this.$getRawTransaction(history[i].tx_hash, false, true);
        transactions.push(tx);
        loadingIndicators.setProgress('address-' + address, (i + 1) / endIndex * 100);
      }

      return transactions;
    } catch (e: any) {
      loadingIndicators.setProgress('address-' + address, 100);
      throw new Error(typeof e === 'string' ? e : e && e.message || e);
    }
  }

  async $getScriptHash(scripthash: string): Promise<IEsploraApi.ScriptHash> {
    try {
      const balance = await this.electrumClient.blockchainScripthash_getBalance(scripthash);
      let history = memoryCache.get<IElectrumApi.ScriptHashHistory[]>('Scripthash_getHistory', scripthash);
      if (!history) {
        history = await this.electrumClient.blockchainScripthash_getHistory(scripthash);
        memoryCache.set('Scripthash_getHistory', scripthash, history, 2);
      }

      const unconfirmed = history ? history.filter((h) => h.fee).length : 0;

      return {
        'scripthash': scripthash,
        'chain_stats': {
          'funded_txo_count': 0,
          'funded_txo_sum': balance.confirmed ? balance.confirmed : 0,
          'spent_txo_count': 0,
          'spent_txo_sum': balance.confirmed < 0 ? balance.confirmed : 0,
          'tx_count': (history?.length || 0) - unconfirmed,
        },
        'mempool_stats': {
          'funded_txo_count': 0,
          'funded_txo_sum': balance.unconfirmed > 0 ? balance.unconfirmed : 0,
          'spent_txo_count': 0,
          'spent_txo_sum': balance.unconfirmed < 0 ? -balance.unconfirmed : 0,
          'tx_count': unconfirmed,
        },
        'electrum': true,
      };
    } catch (e: any) {
      throw new Error(typeof e === 'string' ? e : e && e.message || e);
    }
  }

  /** @asyncUnsafe */
  async $getAddressUtxos(address: string): Promise<IEsploraApi.UTXO[]> {
    const addressInfo = await this.bitcoindClient.validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
      throw new Error('Invalid Bitcoin address');
    }
    const scripthash = this.encodeScriptHash(addressInfo.scriptPubKey);
    return this.$getScriptHashUtxos(scripthash);
  }

  async $getScriptHashTransactions(scripthash: string, lastSeenTxId?: string): Promise<IEsploraApi.Transaction[]> {
    try {
      loadingIndicators.setProgress('address-' + scripthash, 0);

      const transactions: IEsploraApi.Transaction[] = [];
      let history = memoryCache.get<IElectrumApi.ScriptHashHistory[]>('Scripthash_getHistory', scripthash);
      if (!history) {
        history = await this.electrumClient.blockchainScripthash_getHistory(scripthash);
        memoryCache.set('Scripthash_getHistory', scripthash, history, 2);
      }
      if (!history) {
        throw new Error('failed to get scripthash history');
      }
      history.sort((a, b) => (b.height || 9999999) - (a.height || 9999999));

      let startingIndex = 0;
      if (lastSeenTxId) {
        const pos = history.findIndex((historicalTx) => historicalTx.tx_hash === lastSeenTxId);
        if (pos) {
          startingIndex = pos + 1;
        }
      }
      const endIndex = Math.min(startingIndex + 10, history.length);

      for (let i = startingIndex; i < endIndex; i++) {
        const tx = await this.$getRawTransaction(history[i].tx_hash, false, true);
        transactions.push(tx);
        loadingIndicators.setProgress('address-' + scripthash, (i + 1) / endIndex * 100);
      }

      return transactions;
    } catch (e: any) {
      loadingIndicators.setProgress('address-' + scripthash, 100);
      throw new Error(typeof e === 'string' ? e : e && e.message || e);
    }
  }

  /** @asyncUnsafe */
  async $getScriptHashUtxos(scripthash: string): Promise<IEsploraApi.UTXO[]> {
    const utxos = await this.$getScriptHashUnspent(scripthash);
    const result: IEsploraApi.UTXO[] = [];
    for(const utxo of utxos) {
      if(utxo.height===0) {
        //Unconfirmed
        result.push({
          txid: utxo.tx_hash,
          vout: utxo.tx_pos,
          status: {
            confirmed: false
          },
          value: utxo.value
        });
      } else {
        //Confirmed
        const blockHash = await this.$getBlockHash(utxo.height);
        const block = await this.$getBlock(blockHash);
        result.push({
          txid: utxo.tx_hash,
          vout: utxo.tx_pos,
          status: {
            confirmed: true,
            block_height: utxo.height,
            block_hash: blockHash,
            block_time: block.timestamp
          },
          value: utxo.value
        });
      }
    }
    return result;
  }

  private $getScriptHashUnspent(scriptHash: string): Promise<IElectrumApi.ScriptHashUtxos[]> {
    return this.electrumClient.blockchainScripthash_listunspent(scriptHash);
  }

  /**
   * Per-transaction net value for an address (the Esplora `/address/:addr/txs/summary`
   * equivalent), so the wallet/treasury feature works with an Electrum server.
   *
   * The Electrum protocol's history only returns txids and heights, so each
   * confirmed transaction is fetched with its prevouts from Bitcoin Core and the
   * address's outputs minus its spent inputs are summed. Confirmed results never
   * change and are cached per address+txid. Unconfirmed transactions are left out,
   * matching Esplora's chain-only summary; they're added when their block arrives.
   *
   * @asyncUnsafe
   */
  async $getAddressTransactionSummary(address: string): Promise<IEsploraApi.AddressTxSummary[]> {
    const addressInfo = await this.bitcoindClient.validateAddress(address);
    if (!addressInfo || !addressInfo.isvalid) {
      throw new Error('Invalid Bitcoin address');
    }

    const history = await this.$getScriptHashHistory(addressInfo.scriptPubKey);
    const summary: IEsploraApi.AddressTxSummary[] = [];
    for (const item of history) {
      if (item.height <= 0) {
        continue; // unconfirmed
      }
      const cacheKey = `${address}:${item.tx_hash}`;
      let row = memoryCache.get<IEsploraApi.AddressTxSummary>('AddressTxSummary', cacheKey);
      if (!row) {
        const tx = await this.$getRawTransaction(item.tx_hash, false, true);
        let value = 0;
        for (const vout of tx.vout) {
          if (vout.scriptpubkey_address === address) {
            value += vout.value;
          }
        }
        for (const vin of tx.vin) {
          if (vin.prevout?.scriptpubkey_address === address) {
            value -= vin.prevout.value;
          }
        }
        row = {
          txid: item.tx_hash,
          value,
          height: item.height,
          time: tx.status?.block_time ?? 0,
        };
        memoryCache.set('AddressTxSummary', cacheKey, row, 24 * 60 * 60);
      }
      summary.push(row);
    }
    // newest first, like Esplora
    return summary.sort((a, b) => b.height - a.height);
  }

  /** @asyncUnsafe */
  async $getTransactionMerkleProof(txId: string): Promise<IEsploraApi.MerkleProof> {
    const tx = await this.$getRawTransaction(txId);
    return this.electrumClient.blockchainTransaction_getMerkle(txId, tx.status.block_height);
  }

  private $getScriptHashBalance(scriptHash: string): Promise<IElectrumApi.ScriptHashBalance> {
    return this.electrumClient.blockchainScripthash_getBalance(this.encodeScriptHash(scriptHash));
  }

  private $getScriptHashHistory(scriptHash: string): Promise<IElectrumApi.ScriptHashHistory[]> {
    const fromCache = memoryCache.get<IElectrumApi.ScriptHashHistory[]>('Scripthash_getHistory', scriptHash);
    if (fromCache) {
      return Promise.resolve(fromCache);
    }
    return this.electrumClient.blockchainScripthash_getHistory(this.encodeScriptHash(scriptHash))
      .then((history) => {
        memoryCache.set('Scripthash_getHistory', scriptHash, history, 2);
        return history;
      });
  }

  private encodeScriptHash(scriptPubKey: string): string {
    const addrScripthash = crypto.enc.Hex.stringify(crypto.SHA256(crypto.enc.Hex.parse(scriptPubKey)));
    return addrScripthash!.match(/.{2}/g)!.reverse().join('');
  }

}

export default BitcoindElectrsApi;
