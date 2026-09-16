import React, { useState, useEffect } from 'react';
import { X, Search, Package } from 'lucide-react';
import api from '../api/api';

interface Product {
  id: string;
  internalCode: string;
  description: string;
  quantity: number;
  unit: string;
  status: string;
  supplier?: {
    name: string;
  };
}

interface SelectedProduct {
  productId: string;
  quantity: number;
  product?: Product;
}

interface ProductSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (products: SelectedProduct[]) => void;
  alreadySelected: SelectedProduct[];
}

const extractList = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const ProductSelector: React.FC<ProductSelectorProps> = ({
  open,
  onClose,
  onSelect,
  alreadySelected,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(alreadySelected);

  useEffect(() => {
    if (open) {
      loadProducts();
      setSelectedProducts(alreadySelected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('[ProductSelector] Loading products...');
      
      const response = await api.get('/products');
      
      console.log('[ProductSelector] Backend response:', response.data);
      const products = extractList<Product>(response.data);
      console.log('[ProductSelector] Total products:', products.length);
      
      // Filter only products available for transport
      const availableProducts = products.filter((product: Product) => {
        const isInStorage = product.status === 'IN_STORAGE';
        const hasQuantity = product.quantity > 0;
        
        console.log(`  - ${product.internalCode}: status=${product.status}, qty=${product.quantity}, available=${isInStorage && hasQuantity}`);
        
        return isInStorage && hasQuantity;
      });
      
      console.log('[ProductSelector] Available products:', availableProducts.length);
      console.log('📋 [ProductSelector] Filtered products:', availableProducts.map((p: Product) => ({
        code: p.internalCode,
        desc: p.description,
        qty: p.quantity,
        status: p.status
      })));
      
      setProducts(availableProducts);
      
      if (availableProducts.length === 0) {
        console.warn('⚠️ [ProductSelector] No products available (IN_STORAGE with quantity > 0)');
        setError('No products available for transport. Make sure there are products with "In Storage" status and available quantity.');
      }
      
    } catch (error: any) {
      console.error('[ProductSelector] Error loading products:', error);
      console.error('📋 [ProductSelector] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      setError('Error loading products. Try again.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      product.internalCode.toLowerCase().includes(searchLower) ||
      product.description.toLowerCase().includes(searchLower) ||
      product.supplier?.name?.toLowerCase().includes(searchLower)
    );
  });

  const isSelected = (productId: string) => {
    return selectedProducts.some((p) => p.productId === productId);
  };

  const getSelectedQuantity = (productId: string) => {
    return selectedProducts.find((p) => p.productId === productId)?.quantity || 0;
  };

  const handleQuantityChange = (productId: string, quantity: number, maxQuantity: number) => {
    if (quantity < 0) return;
    
    if (quantity > maxQuantity) {
      alert(`Quantity máxima disponível: ${maxQuantity}`);
      return;
    }

    if (quantity === 0) {
      // Remove product
      setSelectedProducts(selectedProducts.filter((p) => p.productId !== productId));
      console.log(`🗑️ product ${productId} removido da seleção`);
    } else {
      // Atualiza ou adiciona product
      const product = products.find((p) => p.id === productId);
      const existing = selectedProducts.find((p) => p.productId === productId);

      if (existing) {
        setSelectedProducts(
          selectedProducts.map((p) =>
            p.productId === productId ? { ...p, quantity } : p
          )
        );
        console.log(`📝 Quantity atualizada: ${productId} = ${quantity}`);
      } else {
        setSelectedProducts([
          ...selectedProducts,
          { productId, quantity, product },
        ]);
        console.log(`➕ product adicionado: ${product?.internalCode} (${quantity} un)`);
      }
    }
  };

  const handleConfirm = () => {
    if (selectedProducts.length === 0) {
      alert('Select at least one product');
      return;
    }

    const invalidProducts = selectedProducts.filter((sp) => sp.quantity <= 0);
    if (invalidProducts.length > 0) {
      alert('All products must have quantity greater than zero');
      return;
    }

    console.log(' [ProductSelector] Confirming seleção:', selectedProducts.map(p => ({
      code: p.product?.internalCode,
      qty: p.quantity
    })));

    //  CORREÇÃO: Send apenas productId e quantity (sem o objeto product completo)
    const cleanedProducts = selectedProducts.map(p => ({
      productId: p.productId,
      quantity: p.quantity
    }));

    console.log('📤 [ProductSelector] Dados limpos enviados:', cleanedProducts);

    onSelect(cleanedProducts);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-amber-500/50 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-amber-500/30 bg-gradient-to-r from-amber-900/20 to-amber-800/10">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/20 p-2 rounded-lg">
                <Package className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Select Products</h3>
                <p className="text-sm text-amber-300/70 mt-1">
                  {selectedProducts.length} product(s) selected
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-amber-400 transition-colors p-2 hover:bg-amber-500/10 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-amber-500/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-amber-500" />
              <input
                type="text"
                placeholder="Search by code, description or supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-amber-500/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          {/* Products List */}
          <div className="overflow-y-auto max-h-[50vh] p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mb-4"></div>
                <p>Loading products...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-red-400">
                <div className="bg-red-900/20 border-2 border-red-500/50 rounded-lg p-6 max-w-md">
                  <div className="flex items-center gap-3 mb-3">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="font-semibold">Error loading</p>
                  </div>
                  <p className="text-sm text-red-300">{error}</p>
                  <button
                    onClick={loadProducts}
                    className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors w-full font-semibold"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Package className="w-16 h-16 text-slate-600 mb-4" />
                <p className="text-lg font-semibold text-amber-400">No products found</p>
                <p className="text-sm mt-2 text-center max-w-md">
                  {searchTerm ? (
                    'Try adjusting your search'
                  ) : products.length === 0 ? (
                    <>
                      There are no products available for transport.
                      <br />
                      <span className="text-xs text-slate-500 mt-2 block">
                        (Make sure there are products with "In Storage" status and available quantity)
                      </span>
                    </>
                  ) : (
                    'No products match your search'
                  )}
                </p>
                {products.length === 0 && !loading && (
                  <button
                    onClick={loadProducts}
                    className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors font-semibold"
                  >
                    Reload
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProducts.map((product) => {
                  const selected = isSelected(product.id);
                  const quantity = getSelectedQuantity(product.id);

                  return (
                    <div
                      key={product.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selected
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-700 hover:border-amber-500/50 bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Product Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-1 bg-slate-700 text-amber-300 text-xs font-bold rounded">
                              {product.internalCode}
                            </span>
                            {product.supplier?.name && (
                              <span className="text-sm text-slate-400">
                                {product.supplier.name}
                              </span>
                            )}
                            <span className="px-2 py-1 bg-emerald-900/30 text-emerald-400 text-xs font-bold rounded border border-emerald-500/30">
                              {product.status === 'IN_STORAGE' ? 'Em Armazém' : product.status}
                            </span>
                          </div>
                          <h4 className="text-white font-semibold mb-1">
                            {product.description}
                          </h4>
                          <p className="text-sm text-slate-400">
                            Disponível: <span className="text-amber-300 font-semibold">
                              {product.quantity} {product.unit}
                            </span>
                          </p>
                        </div>

                        {/* Quantity Input */}
                        <div className="flex flex-col items-end gap-2">
                          <label className="text-xs text-slate-400 font-medium">
                            Quantity
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleQuantityChange(
                                  product.id,
                                  Math.max(0, quantity - 1),
                                  product.quantity
                                )
                              }
                              className="w-8 h-8 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center justify-center font-bold"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={product.quantity}
                              value={quantity}
                              onChange={(e) =>
                                handleQuantityChange(
                                  product.id,
                                  parseInt(e.target.value) || 0,
                                  product.quantity
                                )
                              }
                              className="w-20 px-3 py-2 bg-slate-700 border border-amber-500/30 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleQuantityChange(
                                  product.id,
                                  Math.min(product.quantity, quantity + 1),
                                  product.quantity
                                )
                              }
                              className="w-8 h-8 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center justify-center font-bold"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs text-slate-500">
                            {product.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-amber-500/30 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-slate-400">
                {selectedProducts.length > 0 ? (
                  <div>
                    <p className="font-semibold text-amber-300">
                      {selectedProducts.length} product(s) selected
                    </p>
                    <p className="text-xs mt-1">
                      Total: {selectedProducts.reduce((sum, p) => sum + p.quantity, 0)} units
                    </p>
                  </div>
                ) : (
                  <p>No products selected</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 border-2 border-amber-500/50 text-amber-400 rounded-lg hover:bg-amber-900/20 transition-all font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={selectedProducts.length === 0}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Package className="w-5 h-5" />
                  Confirmar Seleção
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductSelector;