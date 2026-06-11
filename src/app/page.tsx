'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, 
  DollarSign, 
  Euro, 
  ArrowDownRight, 
  Copy, 
  Check, 
  Coins, 
  Lock, 
  Unlock,
  Info 
} from 'lucide-react';

interface Rates {
  usd_bcv: number;
  eur_bcv: number;
  usdt_binance: number;
}

export default function Home() {
  // Exchange Rates State
  const [rates, setRates] = useState<Rates>({
    usd_bcv: 0,
    eur_bcv: 0,
    usdt_binance: 0,
  });
  
  // Custom Rates Override State
  const [isCustomRates, setIsCustomRates] = useState(false);
  const [customRates, setCustomRates] = useState<Rates>({
    usd_bcv: 0,
    eur_bcv: 0,
    usdt_binance: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Calculator State
  const [activeAmount, setActiveAmount] = useState<string>('100');
  const [activeCurrency, setActiveCurrency] = useState<'VES' | 'USD' | 'EUR' | 'USDT'>('USD');

  // Fetch rates function
  const fetchRates = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    try {
      const response = await fetch('/api/rates');
      if (!response.ok) throw new Error('No se pudieron obtener las tasas de cambio.');
      const data = await response.json();
      
      if (data.rates) {
        setRates(data.rates);
        // Sync custom rates initially or if they are not customized yet
        setCustomRates(prev => {
          if (prev.usd_bcv === 0) return data.rates;
          return prev;
        });
        setLastUpdated(new Date(data.last_updated).toLocaleTimeString('es-VE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }));
      } else {
        throw new Error('Formato de datos no válido.');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch on mount and register PWA Service Worker
  useEffect(() => {
    fetchRates();
    
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registrado:', reg.scope))
        .catch((err) => console.error('Fallo al registrar Service Worker:', err));
    }
  }, [fetchRates]);

  // Active rates to use in calculation (official or custom)
  const activeRates = isCustomRates ? customRates : rates;

  // Copy to clipboard helper
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Conversion Math
  const getConvertedValues = useCallback((amountStr: string, fromCurrency: string) => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return { VES: '', USD: '', EUR: '', USDT: '' };
    }

    const { usd_bcv, eur_bcv, usdt_binance } = activeRates;

    // Avoid division by zero
    if (!usd_bcv || !eur_bcv || !usdt_binance) {
      return { VES: '', USD: '', EUR: '', USDT: '' };
    }

    // Convert input amount to VES first (base currency)
    let amountInVes = 0;
    switch (fromCurrency) {
      case 'VES':
        amountInVes = amount;
        break;
      case 'USD':
        amountInVes = amount * usd_bcv;
        break;
      case 'EUR':
        amountInVes = amount * eur_bcv;
        break;
      case 'USDT':
        amountInVes = amount * usdt_binance;
        break;
    }

    // Convert from VES to all other currencies
    return {
      VES: amountInVes.toFixed(2),
      USD: (amountInVes / usd_bcv).toFixed(2),
      EUR: (amountInVes / eur_bcv).toFixed(2),
      USDT: (amountInVes / usdt_binance).toFixed(2),
    };
  }, [activeRates]);

  const conversions = getConvertedValues(activeAmount, activeCurrency);

  const handleInputChange = (val: string, currency: 'VES' | 'USD' | 'EUR' | 'USDT') => {
    // Replace comma with dot for international standard parsing
    const normalizedVal = val.replace(',', '.');
    // Allow digits, one dot, and prevent leading double zeros
    if (normalizedVal === '' || /^\d*\.?\d*$/.test(normalizedVal)) {
      setActiveAmount(normalizedVal);
      setActiveCurrency(currency);
    }
  };

  const formatCurrency = (valueStr: string) => {
    if (!valueStr) return '0,00';
    const num = parseFloat(valueStr);
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Helper to update custom rate inputs
  const handleCustomRateChange = (key: keyof Rates, valueStr: string) => {
    const value = parseFloat(valueStr);
    setCustomRates(prev => ({
      ...prev,
      [key]: isNaN(value) ? 0 : value
    }));
  };

  return (
    <div className="flex-1 w-full max-w-lg mx-auto px-4 py-4 md:py-8 flex flex-col gap-5 select-none pb-12">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-white/10 pb-4">
        <div className="text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-0.5">
            <Coins className="h-6 w-6 text-amber-500 animate-pulse shrink-0" />
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Tasas Venezuela P2P
            </h1>
          </div>
          <p className="text-zinc-400 text-[11px] md:text-xs">
            Tasas de cambio oficiales BCV y Binance USDT actualizadas
          </p>
        </div>

        {/* Buttons: side-by-side full-width on mobile */}
        <div className="flex items-center gap-2 w-full">
          <button
            onClick={() => fetchRates(true)}
            disabled={loading || refreshing}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.97] disabled:opacity-50 text-white font-semibold text-xs transition-all border border-white/5 shadow-md shadow-black/20 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={() => setIsCustomRates(!isCustomRates)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-xs transition-all border cursor-pointer active:scale-[0.97] ${
              isCustomRates 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' 
                : 'bg-zinc-800 border-white/5 text-zinc-300 hover:bg-zinc-700'
            }`}
            title="Editar tasas"
          >
            {isCustomRates ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            <span>{isCustomRates ? 'Tasas Manuales' : 'Editar Tasas'}</span>
          </button>
        </div>

        {lastUpdated && (
          <div className="text-center sm:text-left text-[9px] text-zinc-500">
            Última actualización: <span className="font-semibold text-zinc-400">{lastUpdated}</span>
          </div>
        )}
      </header>

      {/* Error Message */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-start gap-2 shadow-lg">
          <Info className="h-4.5 w-4.5 shrink-0 text-red-400 mt-0.5" />
          <div>
            <p className="font-semibold">Error al cargar tasas:</p>
            <p className="text-red-300/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Rates Grid - Stacked vertically for mobile, cards are slim and sleek */}
      <section className="flex flex-col gap-3">
        {/* USD Card */}
        <div className="glow-card glass-panel rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-black/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">Dólar BCV</span>
              <span className="text-[9px] text-zinc-500 block">Oficial Banco Central</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-right">
            {loading ? (
              <div className="h-6 w-20 bg-white/5 animate-pulse rounded"></div>
            ) : isCustomRates ? (
              <div className="flex items-center gap-1 border-b border-amber-500/30 w-24">
                <span className="text-[11px] text-amber-500 font-mono">Bs.</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={customRates.usd_bcv || ''}
                  onChange={(e) => handleCustomRateChange('usd_bcv', e.target.value)}
                  className="w-full bg-transparent text-right font-bold font-mono focus:outline-none text-amber-400 text-xl"
                  step="0.01"
                />
              </div>
            ) : (
              <span className="text-2xl font-bold font-mono text-emerald-100">
                Bs. {formatCurrency(rates.usd_bcv.toString())}
              </span>
            )}
            
            {!loading && !isCustomRates && (
              <button 
                onClick={() => copyToClipboard(rates.usd_bcv.toFixed(4), 'usd')}
                className="p-2 rounded-lg hover:bg-white/5 active:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer active:scale-90"
                title="Copiar tasa"
              >
                {copiedId === 'usd' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>

        {/* EUR Card */}
        <div className="glow-card glass-panel rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-black/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
              <Euro className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase">Euro BCV</span>
              <span className="text-[9px] text-zinc-500 block">Oficial Banco Central</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-right">
            {loading ? (
              <div className="h-6 w-20 bg-white/5 animate-pulse rounded"></div>
            ) : isCustomRates ? (
              <div className="flex items-center gap-1 border-b border-amber-500/30 w-24">
                <span className="text-[11px] text-amber-500 font-mono">Bs.</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={customRates.eur_bcv || ''}
                  onChange={(e) => handleCustomRateChange('eur_bcv', e.target.value)}
                  className="w-full bg-transparent text-right font-bold font-mono focus:outline-none text-amber-400 text-xl"
                  step="0.01"
                />
              </div>
            ) : (
              <span className="text-2xl font-bold font-mono text-indigo-100">
                Bs. {formatCurrency(rates.eur_bcv.toString())}
              </span>
            )}
            
            {!loading && !isCustomRates && (
              <button 
                onClick={() => copyToClipboard(rates.eur_bcv.toFixed(4), 'eur')}
                className="p-2 rounded-lg hover:bg-white/5 active:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer active:scale-90"
                title="Copiar tasa"
              >
                {copiedId === 'eur' ? <Check className="h-4 w-4 text-indigo-400" /> : <Copy className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>

        {/* USDT Binance Card */}
        <div className="glow-card glass-panel rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-black/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shrink-0">
              <ArrowDownRight className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase">USDT Compra</span>
              <span className="text-[9px] text-zinc-500 block">Binance P2P Promedio</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-right">
            {loading ? (
              <div className="h-6 w-20 bg-white/5 animate-pulse rounded"></div>
            ) : isCustomRates ? (
              <div className="flex items-center gap-1 border-b border-amber-500/30 w-24">
                <span className="text-[11px] text-amber-500 font-mono">Bs.</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={customRates.usdt_binance || ''}
                  onChange={(e) => handleCustomRateChange('usdt_binance', e.target.value)}
                  className="w-full bg-transparent text-right font-bold font-mono focus:outline-none text-amber-400 text-xl"
                  step="0.01"
                />
              </div>
            ) : (
              <span className="text-2xl font-bold font-mono text-amber-100">
                Bs. {formatCurrency(rates.usdt_binance.toString())}
              </span>
            )}
            
            {!loading && !isCustomRates && (
              <button 
                onClick={() => copyToClipboard(rates.usdt_binance.toString(), 'usdt')}
                className="p-2 rounded-lg hover:bg-white/5 active:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer active:scale-90"
                title="Copiar tasa"
              >
                {copiedId === 'usdt' ? <Check className="h-4 w-4 text-amber-500" /> : <Copy className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Converter Section */}
      <section className="glass-panel rounded-3xl p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
        <div>
          <h2 className="text-sm md:text-base font-bold text-white mb-0.5">
            Calculadora Multidivisa
          </h2>
          <p className="text-[10px] text-zinc-400">
            Toca e ingresa un monto para convertir entre todas las divisas de forma instantánea.
          </p>
        </div>

        {/* Rates Summary list - ultra-compact for mobile */}
        <div className="bg-zinc-900/50 p-2.5 rounded-xl border border-white/5 flex items-center justify-around text-[10px] text-zinc-500 font-mono">
          <div>USD BCV: <span className="font-semibold text-emerald-400">{formatCurrency(activeRates.usd_bcv.toString())}</span></div>
          <div>EUR: <span className="font-semibold text-indigo-400">{formatCurrency(activeRates.eur_bcv.toString())}</span></div>
          <div>USDT: <span className="font-semibold text-amber-400">{formatCurrency(activeRates.usdt_binance.toString())}</span></div>
        </div>

        {/* Inputs Converter Grid - stacked beautifully on mobile */}
        <div className="flex flex-col gap-3">
          {/* VES Input */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/30 border border-white/5 focus-within:border-zinc-700 transition-colors">
            <div className="flex flex-col gap-0.5 flex-1">
              <label className="text-[10px] font-bold text-red-400">Bs. Bolívares (VES)</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*"
                placeholder="0.00"
                value={activeCurrency === 'VES' ? activeAmount : (conversions.VES || '')}
                onChange={(e) => handleInputChange(e.target.value, 'VES')}
                className="w-full bg-transparent text-2xl font-bold font-mono focus:outline-none text-white placeholder-zinc-700"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                onClick={() => copyToClipboard(activeCurrency === 'VES' ? activeAmount : (conversions.VES || ''), 'ves-input')}
                className="p-1.5 rounded-lg hover:bg-white/5 active:bg-white/10 active:scale-90 transition-all cursor-pointer text-zinc-400 hover:text-white"
                title="Copiar cantidad"
              >
                {copiedId === 'ves-input' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
              <span className="text-xs text-zinc-500 font-bold bg-white/5 px-2 py-1 rounded border border-white/5">🇻🇪 VES</span>
            </div>
          </div>

          {/* USD Input */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/30 border border-white/5 focus-within:border-zinc-700 transition-colors">
            <div className="flex flex-col gap-0.5 flex-1">
              <label className="text-[10px] font-bold text-emerald-400">$. Dólar BCV (USD)</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*"
                placeholder="0.00"
                value={activeCurrency === 'USD' ? activeAmount : (conversions.USD || '')}
                onChange={(e) => handleInputChange(e.target.value, 'USD')}
                className="w-full bg-transparent text-2xl font-bold font-mono focus:outline-none text-white placeholder-zinc-700"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                onClick={() => copyToClipboard(activeCurrency === 'USD' ? activeAmount : (conversions.USD || ''), 'usd-input')}
                className="p-1.5 rounded-lg hover:bg-white/5 active:bg-white/10 active:scale-90 transition-all cursor-pointer text-zinc-400 hover:text-white"
                title="Copiar cantidad"
              >
                {copiedId === 'usd-input' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
              <span className="text-xs text-zinc-500 font-bold bg-white/5 px-2 py-1 rounded border border-white/5">🇺🇸 USD BCV</span>
            </div>
          </div>

          {/* EUR Input */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/30 border border-white/5 focus-within:border-zinc-700 transition-colors">
            <div className="flex flex-col gap-0.5 flex-1">
              <label className="text-[10px] font-bold text-indigo-400">€. Euros (EUR)</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*"
                placeholder="0.00"
                value={activeCurrency === 'EUR' ? activeAmount : (conversions.EUR || '')}
                onChange={(e) => handleInputChange(e.target.value, 'EUR')}
                className="w-full bg-transparent text-2xl font-bold font-mono focus:outline-none text-white placeholder-zinc-700"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                onClick={() => copyToClipboard(activeCurrency === 'EUR' ? activeAmount : (conversions.EUR || ''), 'eur-input')}
                className="p-1.5 rounded-lg hover:bg-white/5 active:bg-white/10 active:scale-90 transition-all cursor-pointer text-zinc-400 hover:text-white"
                title="Copiar cantidad"
              >
                {copiedId === 'eur-input' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
              <span className="text-xs text-zinc-500 font-bold bg-white/5 px-2 py-1 rounded border border-white/5">🇪🇺 EUR</span>
            </div>
          </div>

          {/* USDT Input */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/30 border border-white/5 focus-within:border-zinc-700 transition-colors">
            <div className="flex flex-col gap-0.5 flex-1">
              <label className="text-[10px] font-bold text-amber-400">₮. Cripto (USDT)</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*"
                placeholder="0.00"
                value={activeCurrency === 'USDT' ? activeAmount : (conversions.USDT || '')}
                onChange={(e) => handleInputChange(e.target.value, 'USDT')}
                className="w-full bg-transparent text-2xl font-bold font-mono focus:outline-none text-white placeholder-zinc-700"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                onClick={() => copyToClipboard(activeCurrency === 'USDT' ? activeAmount : (conversions.USDT || ''), 'usdt-input')}
                className="p-1.5 rounded-lg hover:bg-white/5 active:bg-white/10 active:scale-90 transition-all cursor-pointer text-zinc-400 hover:text-white"
                title="Copiar cantidad"
              >
                {copiedId === 'usdt-input' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
              <span className="text-xs text-zinc-500 font-bold bg-white/5 px-2 py-1 rounded border border-white/5">🪙 USDT</span>
            </div>
          </div>
        </div>

        {/* Safe conversion alert info */}
        <div className="text-[9px] text-zinc-500 flex items-center gap-1.5 mt-1 px-1">
          <Info className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span>
            Conversiones cruzadas tomando el Bolívar (VES) como moneda puente intermedia.
          </span>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-1 text-[9px] text-zinc-500 text-center">
        <p>© 2026 Tasas Venezuela. Datos de BCV y Binance P2P.</p>
        <p className="flex items-center justify-center gap-1">
          Hecho con <span className="text-red-500 animate-pulse">❤️</span> para dispositivos móviles
        </p>
      </footer>
    </div>
  );
}
