import { NextResponse } from 'next/server';

interface HistoricoItem {
  fuente: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fecha: string;
  moneda?: string;
}

interface DolarApiResponse {
  moneda: string;
  fuente: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
}

interface BinanceAd {
  adv: {
    price: string;
    minSingleTransAmount: string;
    maxSingleTransAmount: string;
    tradeMethods: Array<{ identifier: string }>;
  };
  advertiser: {
    nickName: string;
  };
}

interface BinanceResponse {
  code: string;
  message: string | null;
  data: BinanceAd[] | null;
  success: boolean;
}

// Helper function to calculate the median
function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[half];
  }
  return (sorted[half - 1] + sorted[half]) / 2.0;
}

// Clean and extract Binance P2P rates using median outlier filtering
function extractBinanceRate(ads: BinanceAd[]): number {
  if (!ads || ads.length === 0) return 0;

  const prices = ads.map(ad => parseFloat(ad.adv.price)).filter(p => !isNaN(p));
  if (prices.length === 0) return 0;

  const median = getMedian(prices);
  // Filter out rates deviating by more than 10% from the median to eliminate outliers
  const cleanPrices = prices.filter(p => Math.abs(p - median) / median < 0.1);

  if (cleanPrices.length === 0) return median;

  // We want the lowest price available for the user to buy USDT (SELL ads)
  return Math.min(...cleanPrices);
}

export async function GET() {
  let usd_bcv = 0;
  let usd_bcv_prev = 0;
  let usd_bcv_date = '';
  let usd_bcv_prev_date = '';

  let eur_bcv = 0;
  let eur_bcv_prev = 0;
  let eur_bcv_date = '';
  let eur_bcv_prev_date = '';

  let usdt_binance = 0; // Cost to buy 1 USDT in VES
  let last_updated = new Date().toISOString();
  let errors: string[] = [];

  // 1. Fetch Dolar BCV (Historicos for current + previous day rate)
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/historicos/dolares/oficial', {
      next: { revalidate: 60 } // Cache for 60 seconds
    });
    if (!res.ok) throw new Error(`DolarApi status: ${res.status}`);
    const data: HistoricoItem[] = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const last = data[data.length - 1];
      usd_bcv = last.promedio;
      usd_bcv_date = last.fecha;

      if (data.length > 1) {
        const prev = data[data.length - 2];
        usd_bcv_prev = prev.promedio;
        usd_bcv_prev_date = prev.fecha;
      } else {
        usd_bcv_prev = usd_bcv;
        usd_bcv_prev_date = usd_bcv_date;
      }
    } else {
      throw new Error('Formato de datos no válido en historicos');
    }
  } catch (error: any) {
    try {
      const fallbackRes = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
        next: { revalidate: 60 }
      });
      if (fallbackRes.ok) {
        const fallbackData: DolarApiResponse = await fallbackRes.json();
        usd_bcv = fallbackData.promedio;
        usd_bcv_prev = fallbackData.promedio;
        usd_bcv_date = fallbackData.fechaActualizacion?.split('T')[0] || '';
        usd_bcv_prev_date = usd_bcv_date;
      } else {
        errors.push(`Error fetching USD BCV: ${error.message}`);
      }
    } catch {
      errors.push(`Error fetching USD BCV: ${error.message}`);
    }
  }

  // 2. Fetch Euro BCV (Historicos for current + previous day rate)
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/historicos/euros/oficial', {
      next: { revalidate: 60 }
    });
    if (!res.ok) throw new Error(`DolarApi Euro status: ${res.status}`);
    const data: HistoricoItem[] = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const last = data[data.length - 1];
      eur_bcv = last.promedio;
      eur_bcv_date = last.fecha;

      if (data.length > 1) {
        const prev = data[data.length - 2];
        eur_bcv_prev = prev.promedio;
        eur_bcv_prev_date = prev.fecha;
      } else {
        eur_bcv_prev = eur_bcv;
        eur_bcv_prev_date = eur_bcv_date;
      }
    } else {
      throw new Error('Formato de datos no válido en historicos Euro');
    }
  } catch (error: any) {
    try {
      const fallbackRes = await fetch('https://ve.dolarapi.com/v1/euros/oficial', {
        next: { revalidate: 60 }
      });
      if (fallbackRes.ok) {
        const fallbackData: DolarApiResponse = await fallbackRes.json();
        eur_bcv = fallbackData.promedio;
        eur_bcv_prev = fallbackData.promedio;
        eur_bcv_date = fallbackData.fechaActualizacion?.split('T')[0] || '';
        eur_bcv_prev_date = eur_bcv_date;
      } else {
        errors.push(`Error fetching EUR BCV: ${error.message}`);
      }
    } catch {
      errors.push(`Error fetching EUR BCV: ${error.message}`);
    }
  }

  // 3. Fetch Binance P2P Rates (SELL ads, meaning user is buying USDT)
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  try {
    const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent
      },
      body: JSON.stringify({
        asset: 'USDT',
        fiat: 'VES',
        tradeType: 'SELL',
        merchantCheck: false,
        page: 1,
        rows: 15,
        payTypes: [],
        publisherType: null
      }),
      next: { revalidate: 30 } // Cache for 30 seconds
    });

    if (!res.ok) throw new Error(`Binance P2P HTTP status: ${res.status}`);
    const data: BinanceResponse = await res.json();
    if (data.success && data.data) {
      usdt_binance = extractBinanceRate(data.data);
    } else {
      throw new Error(data.message || 'Binance P2P returned success: false');
    }
  } catch (error: any) {
    errors.push(`Error fetching Binance P2P: ${error.message}`);
  }

  return NextResponse.json({
    success: errors.length < 3, // Success if we got at least some rates
    rates: {
      usd_bcv,
      usd_bcv_prev,
      usd_bcv_date,
      usd_bcv_prev_date,
      eur_bcv,
      eur_bcv_prev,
      eur_bcv_date,
      eur_bcv_prev_date,
      usdt_binance
    },
    errors: errors.length > 0 ? errors : null,
    last_updated
  });
}
