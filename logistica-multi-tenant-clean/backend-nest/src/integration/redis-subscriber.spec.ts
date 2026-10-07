import { parseStockSyncEvent } from './redis-subscriber';

describe('parseStockSyncEvent', () => {
  const validEvent = {
    eventId: '0199c2d8-65f1-7a16-aec4-7c9c2b8cb01a',
    type: 'stock_sync',
    companyId: 'tenant-a',
    sku: 'SKU-1',
    stock: 12,
    productUpdatedAt: '2026-10-06T12:00:00.000Z',
    description: 'Test product',
    source: 'chatops',
    timestamp: '2026-10-06T12:01:00.000Z',
  };

  it('accepts a tenant-scoped stock snapshot with version metadata', () => {
    expect(parseStockSyncEvent(JSON.stringify(validEvent))).toEqual(validEvent);
  });

  it.each([
    { ...validEvent, eventId: 'not-a-uuid' },
    { ...validEvent, companyId: '' },
    { ...validEvent, stock: -1 },
    { ...validEvent, stock: Number.NaN },
    { ...validEvent, productUpdatedAt: 'not-a-date' },
    { ...validEvent, type: 'stock_delta' },
  ])('rejects an event outside the schema', (event) => {
    expect(() => parseStockSyncEvent(JSON.stringify(event))).toThrow(
      'Stock sync message does not match the required schema',
    );
  });

  it('rejects invalid JSON with an explicit validation error', () => {
    expect(() => parseStockSyncEvent('{')).toThrow(
      'Stock sync message is not valid JSON',
    );
  });
});
