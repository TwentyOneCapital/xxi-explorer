// Tests the Electrum implementation of $getAddressTransactionSummary (used by
// the wallet/treasury feature) against canned Electrum + Bitcoin Core data.

// bitcoin-api.ts pulls in blocks/mempool, which import the API factory back
// (a circular import that only resolves inside the full app); stub them.
jest.mock('../../api/blocks', () => ({ __esModule: true, default: {} }));
jest.mock('../../api/mempool', () => ({ __esModule: true, default: { getMempool: () => ({}) } }));
jest.mock('../../api/transaction-utils', () => ({ __esModule: true, default: {} }));

// testSetup.ts stubs memory-cache as {}; use a tiny working cache here.
jest.mock('../../api/memory-cache', () => {
  const store = new Map<string, any>();
  return {
    __esModule: true,
    default: {
      get: (type: string, id: string) => store.get(`${type}|${id}`) ?? null,
      set: (type: string, id: string, data: any) => { store.set(`${type}|${id}`, data); },
      clear: () => store.clear(),
    },
  };
});

jest.mock('@mempool/electrum-client', () => {
  return jest.fn().mockImplementation(() => ({
    initElectrum: jest.fn().mockResolvedValue(undefined),
    blockchainScripthash_getHistory: jest.fn(),
  }));
});

import BitcoindElectrsApi from '../../api/bitcoin/electrum-api';
import memoryCache from '../../api/memory-cache';

const ADDR = '3FsDiWdG76meMpdCLbVV4dUXhrFyaLrtxL';
const OTHER = 'bc1qother000000000000000000000000000000000';

function tx(txid: string, blockTime: number, vin: any[], vout: any[]): any {
  return { txid, vin, vout, status: { confirmed: true, block_time: blockTime } };
}

describe('Electrum $getAddressTransactionSummary', () => {
  let api: any;
  let getRaw: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    // fresh cache per test
    (memoryCache as any).clear();
    const bitcoindClient = {
      validateAddress: jest.fn().mockResolvedValue({ isvalid: true, address: ADDR, scriptPubKey: 'a914deadbeef87' }),
    };
    api = new BitcoindElectrsApi(bitcoindClient);
    api.electrumClient.blockchainScripthash_getHistory.mockResolvedValue([
      { tx_hash: 'deposit', height: 900000 },
      { tx_hash: 'spend', height: 900010 },
      { tx_hash: 'unrelated-touch', height: 900020 },
      { tx_hash: 'pending', height: 0, fee: 1000 },
    ]);
    const txs: Record<string, any> = {
      // +5 BTC in
      deposit: tx('deposit', 1700000000,
        [{ prevout: { scriptpubkey_address: OTHER, value: 600_000_000 } }],
        [{ scriptpubkey_address: ADDR, value: 500_000_000 }, { scriptpubkey_address: OTHER, value: 99_990_000 }]),
      // spends 5 BTC, gets 1 BTC change back -> net -4 BTC
      spend: tx('spend', 1700006000,
        [{ prevout: { scriptpubkey_address: ADDR, value: 500_000_000 } }],
        [{ scriptpubkey_address: OTHER, value: 399_990_000 }, { scriptpubkey_address: ADDR, value: 100_000_000 }]),
      // touches the address with zero net for it (e.g. dust consolidation elsewhere): 0
      'unrelated-touch': tx('unrelated-touch', 1700012000,
        [{ prevout: { scriptpubkey_address: OTHER, value: 10_000 } }],
        [{ scriptpubkey_address: OTHER, value: 9_000 }]),
    };
    getRaw = jest.spyOn(api, '$getRawTransaction').mockImplementation(async (txid: any) => txs[txid]);
  });

  it('computes the net value per confirmed transaction, newest first', async () => {
    const summary = await api.$getAddressTransactionSummary(ADDR);
    expect(summary).toEqual([
      { txid: 'unrelated-touch', value: 0, height: 900020, time: 1700012000 },
      { txid: 'spend', value: -400_000_000, height: 900010, time: 1700006000 },
      { txid: 'deposit', value: 500_000_000, height: 900000, time: 1700000000 },
    ]);
    // the running sum equals the address's balance (5 - 4 = 1 BTC)
    expect(summary.reduce((s: number, r: any) => s + r.value, 0)).toBe(100_000_000);
  });

  it('skips unconfirmed transactions and fetches prevouts', async () => {
    await api.$getAddressTransactionSummary(ADDR);
    const fetched = getRaw.mock.calls.map((c) => c[0]);
    expect(fetched).not.toContain('pending');
    for (const call of getRaw.mock.calls) {
      expect(call[2]).toBe(true); // addPrevout
    }
  });

  it('caches confirmed rows between calls', async () => {
    await api.$getAddressTransactionSummary(ADDR);
    const firstCalls = getRaw.mock.calls.length;
    await api.$getAddressTransactionSummary(ADDR);
    expect(getRaw.mock.calls.length).toBe(firstCalls);
  });

  it('rejects invalid addresses', async () => {
    api.bitcoindClient.validateAddress.mockResolvedValue({ isvalid: false });
    await expect(api.$getAddressTransactionSummary('nope')).rejects.toThrow('Invalid Bitcoin address');
  });
});
