import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { apiClient } from '@/services/apiClient';
import { useCartStore } from '@/store/cartStore';
import { useResponsive } from '@/hooks/useResponsive';

interface ProductLookup {
  id: string;
  name: string;
  sku: string;
  price: number;
  currentPrice?: number;
  image?: string;
  slug?: string;
}

async function findProductByCode(code: string): Promise<ProductLookup | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const response = await apiClient.get<{ products: any[] }>('/shop/products?limit=200&view=summary');
  if (!response.success || !response.data) {
    return null;
  }

  const product = response.data.products.find((item: any) => {
    const sku = String(item.sku || '').toUpperCase();
    const barcode = String(item.barcode || '').toUpperCase();
    const internalCode = String(item.code || '').toUpperCase();
    return sku === normalized || barcode === normalized || internalCode === normalized;
  });

  if (!product) {
    return null;
  }

  return {
    id: product.id?.toString() || product._id?.toString(),
    name: product.name,
    sku: product.sku,
    price: Number(product.currentPrice ?? product.price ?? 0),
    currentPrice: Number(product.currentPrice ?? product.price ?? 0),
    image: product.images?.[0],
    slug: product.slug,
  };
}

export default function BarcodeScannerPanel() {
  const addItem = useCartStore((state) => state.addItem);
  const { isMobile } = useResponsive();
  const [isOpen, setIsOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState('Aponte a câmera para um código de barras ou use o input manual.');
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const scanner = new Html5Qrcode('barcode-scanner-reader');
    scannerRef.current = scanner;

    let isMounted = true;

    const startScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('Este navegador não suporta acesso à câmera. Tente o modo manual abaixo.');
        return;
      }

      try {
        await scanner.start(
          { facingMode: isMobile ? 'environment' : 'user' },
          { fps: 10, qrbox: { width: 260, height: 150 } },
          async (decodedText) => {
            setStatus(`Código detectado: ${decodedText}`);
            try {
              const product = await findProductByCode(decodedText);
              if (!product) {
                setStatus('Produto não encontrado para este código. Tente outro ou use o input manual.');
                return;
              }

              await addItem({
                id: product.id,
                name: product.name,
                price: product.price,
                to: product.slug ? `/shop/product/${product.slug}` : '/shop',
                quantity: 1,
                image: product.image,
              });

              setLastAdded(product.name);
              setStatus(`Adicionado ao carrinho: ${product.name}`);
              await scanner.stop();
              setIsOpen(false);
            } catch (error: any) {
              setStatus(error?.message || 'Não foi possível processar o código de barras.');
            }
          },
          () => undefined
        );

        if (isMounted) {
          setStatus('Câmera ativa. Aponte para o código de barras do produto.');
        }
      } catch (error) {
        if (isMounted) {
          setStatus('Não foi possível inicializar a câmera. Verifique as permissões do navegador.');
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      scanner.stop().catch(() => undefined);
      scannerRef.current = null;
    };
  }, [addItem, isMobile, isOpen]);

  const handleManualAdd = async () => {
    if (!manualCode.trim()) {
      setStatus('Digite um código antes de adicionar.');
      return;
    }

    try {
      const product = await findProductByCode(manualCode);
      if (!product) {
        setStatus('Produto não encontrado para este código.');
        return;
      }

      await addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        to: product.slug ? `/shop/product/${product.slug}` : '/shop',
        quantity: 1,
        image: product.image,
      });

      setLastAdded(product.name);
      setStatus(`Adicionado ao carrinho: ${product.name}`);
      setManualCode('');
    } catch (error: any) {
      setStatus(error?.message || 'Não foi possível adicionar o produto pelo código.');
    }
  };

  return (
    <section
      style={{
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: '1.25rem',
        background: 'rgba(13,13,13,0.8)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
      }}
    >
      <div>
        <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text)' }}>Scanner de código de barras</p>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--muted-light)', fontSize: 14, lineHeight: 1.6 }}>
          Adicione produtos em segundos usando a câmera do celular ou o código manualmente.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          style={{
            borderRadius: 999,
            padding: '12px 16px',
            background: isOpen ? 'transparent' : 'var(--red)',
            color: 'white',
            border: isOpen ? '1px solid var(--border)' : 'none',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {isOpen ? 'Fechar câmera' : 'Abrir câmera'}
        </button>

        {lastAdded && (
          <span style={{ color: 'var(--muted-light)', fontSize: 13 }}>Último item: {lastAdded}</span>
        )}
      </div>

      <p style={{ margin: 0, color: 'var(--muted-light)', fontSize: 13, lineHeight: 1.5 }}>{status}</p>

      {isOpen && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div id="barcode-scanner-reader" style={{ borderRadius: 16, overflow: 'hidden', minHeight: 280, background: '#101010' }} />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Digite o código manualmente"
              style={{
                flex: 1,
                minWidth: 220,
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.02)',
                color: 'var(--text)',
                padding: '12px 16px',
              }}
            />
            <button
              type="button"
              onClick={handleManualAdd}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '12px 16px',
                background: 'var(--charcoal-2)',
                color: 'var(--text)',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Adicionar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
