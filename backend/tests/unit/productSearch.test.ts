const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
const mockCreate = jest.fn(() => ({ get: mockGet, post: mockPost, delete: mockDelete }));
const mockIsAxiosError = jest.fn((error: any) => Boolean(error?.isAxiosError));

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: mockCreate, isAxiosError: mockIsAxiosError },
  isAxiosError: mockIsAxiosError,
}));

describe('Typesense product search', () => {
  const originalHost = process.env.TYPESENSE_HOST;
  const originalApiKey = process.env.TYPESENSE_API_KEY;

  beforeEach(() => {
    jest.resetModules();
    process.env.TYPESENSE_HOST = 'localhost';
    process.env.TYPESENSE_API_KEY = 'unit-test-key';
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
    mockCreate.mockClear();
    mockIsAxiosError.mockImplementation((error: any) => Boolean(error?.isAxiosError));
  });

  afterAll(() => {
    if (originalHost === undefined) delete process.env.TYPESENSE_HOST;
    else process.env.TYPESENSE_HOST = originalHost;
    if (originalApiKey === undefined) delete process.env.TYPESENSE_API_KEY;
    else process.env.TYPESENSE_API_KEY = originalApiKey;
  });

  it('returns ranked document IDs and exact match count with catalog filters', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { name: 'products' } })
      .mockResolvedValueOnce({
        data: {
          found: 73,
          hits: [
            { document: { id: 'product-2' } },
            { document: { id: 'product-1' } },
          ],
        },
      });
    const { searchProducts } = require('../../server/services/productSearch');

    const result = await searchProducts('office paper', {
      category: '507f1f77bcf86cd799439011',
      page: 2,
      limit: 20,
    });

    expect(result).toEqual({ ids: ['product-2', 'product-1'], total: 73 });
    expect(mockGet.mock.calls[1][1].params).toMatchObject({
      q: 'office paper',
      query_by: 'name,description',
      page: 2,
      per_page: 20,
      filter_by: 'isActive:=true && isDeleted:=false && category:=507f1f77bcf86cd799439011',
    });
  });

  it('falls back explicitly when Typesense is unavailable', async () => {
    mockIsAxiosError.mockImplementation((error: any) => Boolean(error?.isAxiosError));
    const unavailableError = Object.assign(new Error('Typesense unavailable'), {
      isAxiosError: true,
      response: { status: 503 },
    });
    mockGet.mockRejectedValueOnce(unavailableError);
    const { searchProducts } = require('../../server/services/productSearch');

    await expect(searchProducts('office paper', { page: 1, limit: 20 })).resolves.toBeNull();
  });
});
