import Decimal from 'decimal.js';
import { redis, REDIS_KEYS } from '@/config/redis';
import { prisma } from '@/config/database';
import { logger } from '@/config/logger';
import { IndodaxExchange } from './indodax.exchange';
import { TokocryptoExchange } from './tokocrypto.exchange';
import { BinanceExchange } from './binance.exchange';
import { OkxExchange } from './okx.exchange';
import { BaseExchange, QuoteResult } from './base.exchange';
import type { ExchangeProvider } from '@prisma/client';

const RATE_CACHE_TTL = 30; // seconds

// Pairs that support IDR directly
const IDR_PAIRS: Record<string, Record<string, string>> = {
  INDODAX: { BTC: 'BTC_IDR', ETH: 'ETH_IDR', USDT: 'USDT_IDR', BNB: 'BNB_IDR', SOL: 'SOL_IDR' },
  TOKOCRYPTO: { BTC: 'BTCIDR', ETH: 'ETHIDR', USDT: 'USDTIDR', BNB: 'BNBIDR', SOL: 'SOLIDR' },
};

class ExchangeFactory {
  private exchanges: Map<ExchangeProvider, BaseExchange>;

  constructor() {
    this.exchanges = new Map([
      ['INDODAX', new IndodaxExchange()],
      ['TOKOCRYPTO', new TokocryptoExchange()],
      ['BINANCE', new BinanceExchange()],
      ['OKX', new OkxExchange()],
    ]);
  }

  getExchange(provider: ExchangeProvider): BaseExchange {
    const exchange = this.exchanges.get(provider);
    if (!exchange) throw new Error(`Unknown exchange provider: ${provider}`);
    return exchange;
  }

  getPairForExchange(provider: ExchangeProvider, currency: string): string | null {
    return IDR_PAIRS[provider]?.[currency] ?? null;
  }

  /**
   * Get the best cashout quote across all exchanges that support direct IDR pairs.
   * Returns sorted by idrNet descending (best for user first).
   */
  async getBestQuotes(currency: string, amount: Decimal): Promise<QuoteResult[]> {
    const quotes: QuoteResult[] = [];
    const providers: ExchangeProvider[] = ['INDODAX', 'TOKOCRYPTO'];

    await Promise.allSettled(
      providers.map(async (provider) => {
        const pair = this.getPairForExchange(provider, currency);
        if (!pair) return;

        const cacheKey = REDIS_KEYS.exchangeRate(provider, pair);
        const cached = await redis.get(cacheKey);

        let quote: QuoteResult;

        if (cached) {
          const rate = JSON.parse(cached) as { bidPrice: string };
          quote = {
            provider,
            pair,
            cryptoAmount: amount,
            idrGross: amount.mul(rate.bidPrice),
            exchangeFee: amount.mul(rate.bidPrice).mul(0.001),
            idrNet: amount.mul(rate.bidPrice).mul(0.999),
            rate: new Decimal(rate.bidPrice),
          };
        } else {
          const exchange = this.getExchange(provider);
          quote = await exchange.getQuote(pair, amount);
          await redis.setex(cacheKey, RATE_CACHE_TTL, JSON.stringify({ bidPrice: quote.rate.toString() }));
        }

        quotes.push(quote);
      }),
    );

    return quotes.sort((a, b) => b.idrNet.comparedTo(a.idrNet));
  }

  /**
   * Refresh rates for all exchanges and store to DB + Redis cache.
   */
  async refreshAllRates(currency: string): Promise<void> {
    const providers: ExchangeProvider[] = ['INDODAX', 'TOKOCRYPTO'];

    await Promise.allSettled(
      providers.map(async (provider) => {
        const pair = this.getPairForExchange(provider, currency);
        if (!pair) return;

        try {
          const exchange = this.getExchange(provider);
          const price = await exchange.getPrice(pair);

          await redis.setex(
            REDIS_KEYS.exchangeRate(provider, pair),
            RATE_CACHE_TTL,
            JSON.stringify({ bidPrice: price.bidPrice.toString(), askPrice: price.askPrice.toString() }),
          );

          await prisma.exchangeRate.create({
            data: {
              provider,
              baseCurrency: currency as never,
              bidPrice: price.bidPrice.toFixed(8),
              askPrice: price.askPrice.toFixed(8),
            },
          });
        } catch (err) {
          logger.error(`Failed to refresh rate for ${provider} ${pair}`, { error: err });
        }
      }),
    );
  }
}

export const exchangeFactory = new ExchangeFactory();
