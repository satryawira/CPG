import axios from 'axios';
import { env } from '@/config/env';
import { hmacSha256 } from '@/utils/crypto.util';
import { AppError, HttpStatus } from '@/utils/AppError';
import { BaseExchange, PriceData, SellOrderParams, OrderResult } from './base.exchange';
import Decimal from 'decimal.js';

/**
 * Binance Exchange Integration
 * REST API v3: https://binance-docs.github.io/apidocs/spot/en/
 * Primarily used for USDT pairs: BTCUSDT, ETHUSDT
 * IDR conversion requires routing through Indodax/Tokocrypto
 */
export class BinanceExchange extends BaseExchange {
  readonly name = 'BINANCE';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor() {
    super();
    this.baseUrl = env.BINANCE_BASE_URL;
    this.apiKey = env.BINANCE_API_KEY || '';
    this.apiSecret = env.BINANCE_API_SECRET || '';
  }

  private signQuery(params: Record<string, string | number>): string {
    const query = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString();
    const signature = hmacSha256(query, this.apiSecret);
    return `${query}&signature=${signature}`;
  }

  private headers() {
    return { 'X-MBX-APIKEY': this.apiKey };
  }

  async getPrice(pair: string): Promise<PriceData> {
    // pair: BTCUSDT, ETHUSDT (no underscore for Binance)
    const symbol = pair.replace('_', '');
    const response = await axios.get(`${this.baseUrl}/api/v3/ticker/bookTicker`, {
      params: { symbol },
    });

    const data = response.data as { bidPrice: string; askPrice: string };
    return {
      pair,
      bidPrice: new Decimal(data.bidPrice),
      askPrice: new Decimal(data.askPrice),
      timestamp: new Date(),
    };
  }

  async createMarketSellOrder(params: SellOrderParams): Promise<OrderResult> {
    const symbol = params.pair.replace('_', '');
    const timestamp = Date.now();
    const signedQuery = this.signQuery({ symbol, side: 'SELL', type: 'MARKET', quantity: params.quantity.toString(), timestamp });

    const response = await axios.post(`${this.baseUrl}/api/v3/order?${signedQuery}`, null, {
      headers: this.headers(),
    });

    const order = response.data as { orderId: number; status: string; executedQty: string; cummulativeQuoteQty: string; fills: Array<{ commission: string }> };
    const filled = new Decimal(order.executedQty);
    const quoteQty = new Decimal(order.cummulativeQuoteQty);
    const fee = order.fills?.reduce((acc, f) => acc.add(f.commission), new Decimal(0)) ?? new Decimal(0);

    return {
      orderId: String(order.orderId),
      status: 'FILLED',
      filledQty: filled,
      avgPrice: filled.gt(0) ? quoteQty.div(filled) : new Decimal(0),
      fee,
      idrTotal: quoteQty, // Note: this is in USDT for Binance, not IDR
    };
  }

  async getOrderById(orderId: string, pair?: string): Promise<OrderResult> {
    const symbol = pair?.replace('_', '') || '';
    const timestamp = Date.now();
    const signedQuery = this.signQuery({ symbol, orderId, timestamp });

    const response = await axios.get(`${this.baseUrl}/api/v3/order?${signedQuery}`, {
      headers: this.headers(),
    });

    const order = response.data as { orderId: number; status: string; executedQty: string; cummulativeQuoteQty: string };
    const filled = new Decimal(order.executedQty);
    const quoteQty = new Decimal(order.cummulativeQuoteQty);

    const statusMap: Record<string, OrderResult['status']> = {
      FILLED: 'FILLED', NEW: 'OPEN', CANCELED: 'CANCELLED', PARTIALLY_FILLED: 'PARTIAL',
    };

    return {
      orderId: String(order.orderId),
      status: statusMap[order.status] || 'OPEN',
      filledQty: filled,
      avgPrice: filled.gt(0) ? quoteQty.div(filled) : new Decimal(0),
      fee: new Decimal(0),
      idrTotal: quoteQty,
    };
  }

  async getDepositAddress(currency: string, network: string): Promise<string> {
    const timestamp = Date.now();
    const signedQuery = this.signQuery({ coin: currency, network, timestamp });

    const response = await axios.get(`${this.baseUrl}/sapi/v1/capital/deposit/address?${signedQuery}`, {
      headers: this.headers(),
    });

    const data = response.data as { address: string };
    if (!data.address) throw new AppError(`No deposit address for ${currency}`, HttpStatus.NOT_FOUND);
    return data.address;
  }
}
