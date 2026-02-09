import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from "lightweight-charts";
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData, Time } from "lightweight-charts";
import { formatPrice } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { ExternalLink } from "lucide-react";

interface ChartToken {
  id: string | number;
  symbol: string;
  price: number;
  priceChange24h: number | null;
  chain: string | null;
  address?: string;
  pairAddress?: string | null;
}

interface PriceChartProps {
  token: ChartToken | null;
}

interface OHLCVCandle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
}

const CHAIN_SLUG_MAP: Record<string, string> = {
  solana: "solana",
  ethereum: "ethereum",
  base: "base",
  bsc: "bsc",
  tron: "tron",
};

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D"] as const;
type Timeframe = typeof TIMEFRAMES[number];

function getDexScreenerUrl(token: ChartToken, embed: boolean): string | null {
  const chainSlug = CHAIN_SLUG_MAP[token.chain || "solana"] || "solana";
  const identifier = token.pairAddress || token.address;
  if (!identifier) return null;
  const base = `https://dexscreener.com/${chainSlug}/${identifier}`;
  if (embed) return `${base}?embed=1&theme=dark&trades=0&info=0`;
  return base;
}

function calcSMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += closes[j];
      result.push(sum / period);
    }
  }
  return result;
}

function calcEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  result[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    result[i] = data[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

function calcRSI(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (closes.length < period + 1) return closes.map(() => null);

  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  result.push(null);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < period - 1; i++) result.push(null);

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
  }

  return result;
}

function calcMACD(closes: number[]): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  if (closes.length < 26) return { macd: closes.map(() => null), signal: closes.map(() => null), histogram: closes.map(() => null) };

  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const validMacd = macdLine.slice(25);
  const signalLine = calcEMA(validMacd, 9);

  const macd: (number | null)[] = [];
  const signal: (number | null)[] = [];
  const histogram: (number | null)[] = [];

  for (let i = 0; i < 25; i++) {
    macd.push(null);
    signal.push(null);
    histogram.push(null);
  }

  for (let i = 0; i < validMacd.length; i++) {
    macd.push(validMacd[i]);
    signal.push(signalLine[i]);
    histogram.push(validMacd[i] - signalLine[i]);
  }

  return { macd, signal, histogram };
}

function calcBollingerBands(closes: number[], period: number = 20, mult: number = 2): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = calcSMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSq += (closes[j] - middle[i]!) * (closes[j] - middle[i]!);
      }
      const stdDev = Math.sqrt(sumSq / period);
      upper.push(middle[i]! + mult * stdDev);
      lower.push(middle[i]! - mult * stdDev);
    }
  }

  return { upper, middle, lower };
}

export function PriceChart({ token }: PriceChartProps) {
  const isMobile = useIsMobile();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma7SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma25SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [showMA, setShowMA] = useState(true);
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [showBB, setShowBB] = useState(false);

  const tokenId = token?.id;

  const { data: ohlcvData } = useQuery<OHLCVCandle[]>({
    queryKey: [`/api/tokens/${tokenId}/ohlcv/${timeframe}`],
    enabled: !!tokenId,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const hasOhlcvData = ohlcvData && ohlcvData.length > 0;

  const indicators = useMemo(() => {
    if (!ohlcvData || ohlcvData.length === 0) return null;
    const closes = ohlcvData.map(c => c.c);
    const rsiValues = calcRSI(closes);
    const macdValues = calcMACD(closes);
    const lastRsi = rsiValues.filter(v => v !== null).pop() ?? null;
    const lastMacd = macdValues.macd.filter(v => v !== null).pop() ?? null;
    const lastSignal = macdValues.signal.filter(v => v !== null).pop() ?? null;
    const lastHist = macdValues.histogram.filter(v => v !== null).pop() ?? null;
    return { lastRsi, lastMacd, lastSignal, lastHist };
  }, [ohlcvData]);

  const initChart = useCallback(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(255,255,255,0.5)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: "rgba(255,255,255,0.15)",
          labelBackgroundColor: "#1a1a2e",
        },
        horzLine: {
          color: "rgba(255,255,255,0.15)",
          labelBackgroundColor: "#1a1a2e",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
        scaleMargins: { top: 0.05, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const ma7Series = chart.addSeries(LineSeries, {
      color: "#eab308",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const ma25Series = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const bbUpper = chart.addSeries(LineSeries, {
      color: "rgba(156,163,175,0.5)",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const bbMiddle = chart.addSeries(LineSeries, {
      color: "rgba(156,163,175,0.7)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const bbLower = chart.addSeries(LineSeries, {
      color: "rgba(156,163,175,0.5)",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ma7SeriesRef.current = ma7Series;
    ma25SeriesRef.current = ma25Series;
    bbUpperRef.current = bbUpper;
    bbMiddleRef.current = bbMiddle;
    bbLowerRef.current = bbLower;
  }, []);

  useEffect(() => {
    if (!hasOhlcvData) {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      return;
    }

    if (!chartRef.current) {
      initChart();
    }

    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const candles: CandlestickData<Time>[] = ohlcvData!.map(c => ({
      time: c.t as Time,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
    }));

    const volumes: HistogramData<Time>[] = ohlcvData!.map(c => ({
      time: c.t as Time,
      value: c.v,
      color: c.c >= c.o ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
    }));

    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current.setData(volumes);

    const closes = ohlcvData!.map(c => c.c);
    const times = ohlcvData!.map(c => c.t as Time);

    if (showMA && ma7SeriesRef.current && ma25SeriesRef.current) {
      const sma7 = calcSMA(closes, 7);
      const sma25 = calcSMA(closes, 25);
      const ma7Data: LineData<Time>[] = [];
      const ma25Data: LineData<Time>[] = [];
      for (let i = 0; i < times.length; i++) {
        if (sma7[i] !== null) ma7Data.push({ time: times[i], value: sma7[i]! });
        if (sma25[i] !== null) ma25Data.push({ time: times[i], value: sma25[i]! });
      }
      ma7SeriesRef.current.setData(ma7Data);
      ma25SeriesRef.current.setData(ma25Data);
      ma7SeriesRef.current.applyOptions({ visible: true });
      ma25SeriesRef.current.applyOptions({ visible: true });
    } else if (ma7SeriesRef.current && ma25SeriesRef.current) {
      ma7SeriesRef.current.setData([]);
      ma25SeriesRef.current.setData([]);
      ma7SeriesRef.current.applyOptions({ visible: false });
      ma25SeriesRef.current.applyOptions({ visible: false });
    }

    if (showBB && bbUpperRef.current && bbMiddleRef.current && bbLowerRef.current) {
      const bb = calcBollingerBands(closes);
      const upperData: LineData<Time>[] = [];
      const middleData: LineData<Time>[] = [];
      const lowerData: LineData<Time>[] = [];
      for (let i = 0; i < times.length; i++) {
        if (bb.upper[i] !== null) upperData.push({ time: times[i], value: bb.upper[i]! });
        if (bb.middle[i] !== null) middleData.push({ time: times[i], value: bb.middle[i]! });
        if (bb.lower[i] !== null) lowerData.push({ time: times[i], value: bb.lower[i]! });
      }
      bbUpperRef.current.setData(upperData);
      bbMiddleRef.current.setData(middleData);
      bbLowerRef.current.setData(lowerData);
      bbUpperRef.current.applyOptions({ visible: true });
      bbMiddleRef.current.applyOptions({ visible: true });
      bbLowerRef.current.applyOptions({ visible: true });
    } else if (bbUpperRef.current && bbMiddleRef.current && bbLowerRef.current) {
      bbUpperRef.current.setData([]);
      bbMiddleRef.current.setData([]);
      bbLowerRef.current.setData([]);
      bbUpperRef.current.applyOptions({ visible: false });
      bbMiddleRef.current.applyOptions({ visible: false });
      bbLowerRef.current.applyOptions({ visible: false });
    }

    chartRef.current.timeScale().fitContent();
  }, [ohlcvData, hasOhlcvData, showMA, showBB, initChart]);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
  }, [tokenId]);

  const embedUrl = useMemo(() => {
    if (!token) return null;
    return getDexScreenerUrl(token, true);
  }, [token?.id, token?.address, token?.pairAddress, token?.chain]);

  const fullUrl = useMemo(() => {
    if (!token) return null;
    return getDexScreenerUrl(token, false);
  }, [token?.id, token?.address, token?.pairAddress, token?.chain]);

  const isGain = (token?.priceChange24h ?? 0) >= 0;
  const nativeSymbol = token?.chain === "ethereum" || token?.chain === "base" ? "ETH" : token?.chain === "bsc" ? "BNB" : token?.chain === "tron" ? "TRX" : "SOL";

  const rsiColor = indicators?.lastRsi != null
    ? indicators.lastRsi > 70 ? "#ef4444" : indicators.lastRsi < 30 ? "#22c55e" : "rgba(255,255,255,0.6)"
    : "rgba(255,255,255,0.4)";

  const macdColor = indicators?.lastHist != null
    ? indicators.lastHist > 0 ? "#22c55e" : "#ef4444"
    : "rgba(255,255,255,0.4)";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border gap-1 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {token ? (
            <>
              <span className={`font-bold ${isMobile ? "text-[11px]" : "text-sm"}`} data-testid="text-chart-symbol">{token.symbol}/{nativeSymbol}</span>
              <span className={`font-mono font-medium ${isMobile ? "text-[11px]" : "text-sm"}`} data-testid="text-chart-price">{formatPrice(token.price)}</span>
              <span className={`font-mono ${isGain ? "text-gain" : "text-loss"} ${isMobile ? "text-[10px]" : "text-xs"}`} data-testid="text-chart-change">
                {(token.priceChange24h ?? 0) >= 0 ? "+" : ""}{(token.priceChange24h ?? 0).toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground" data-testid="text-no-token">Select a token</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {fullUrl && (
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-dexscreener"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">DexScreener</span>
            </a>
          )}
        </div>
      </div>

      {token && hasOhlcvData && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-border flex-wrap">
          <div className="flex items-center gap-0.5">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  timeframe === tf
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`button-timeframe-${tf}`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="w-px h-3 bg-border mx-1" />

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setShowMA(v => !v)}
              className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                showMA ? "bg-yellow-500/20 text-yellow-400" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-toggle-ma"
            >
              MA
            </button>
            <button
              onClick={() => setShowBB(v => !v)}
              className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                showBB ? "bg-gray-500/20 text-gray-300" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-toggle-bb"
            >
              BB
            </button>
            <button
              onClick={() => setShowRSI(v => !v)}
              className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                showRSI ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-toggle-rsi"
            >
              RSI
            </button>
            <button
              onClick={() => setShowMACD(v => !v)}
              className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                showMACD ? "bg-cyan-500/20 text-cyan-400" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-toggle-macd"
            >
              MACD
            </button>
          </div>

          {(showRSI || showMACD) && (
            <>
              <div className="w-px h-3 bg-border mx-1" />
              <div className="flex items-center gap-2">
                {showRSI && indicators?.lastRsi != null && (
                  <span className="text-[10px] font-mono" style={{ color: rsiColor }} data-testid="text-rsi-value">
                    RSI: {indicators.lastRsi.toFixed(1)}
                  </span>
                )}
                {showMACD && indicators?.lastMacd != null && (
                  <span className="text-[10px] font-mono" style={{ color: macdColor }} data-testid="text-macd-value">
                    MACD: {indicators.lastMacd.toFixed(6)} / {indicators.lastSignal?.toFixed(6)}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 relative overflow-hidden" data-testid="chart-container">
        {token && hasOhlcvData ? (
          <div
            ref={chartContainerRef}
            className="absolute inset-0 w-full h-full"
            data-testid="chart-lightweight"
          />
        ) : token && embedUrl ? (
          <iframe
            key={embedUrl}
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            title={`${token.symbol} chart`}
            allow="clipboard-write"
            loading="eager"
            data-testid="chart-dexscreener-iframe"
          />
        ) : token && !embedUrl ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs bg-background" data-testid="text-no-chart">
            Chart unavailable for this token
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs bg-background" data-testid="text-select-token">
            Select a token to view chart
          </div>
        )}
      </div>
    </div>
  );
}
