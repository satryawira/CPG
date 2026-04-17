import axios from 'axios';
import { env } from '@/config/env';
import { hmacSha256 } from '@/utils/crypto.util';
import { AppError, HttpStatus } from '@/utils/AppError';
import { BaseExchange, PriceData, SellOrderParams, OrderResult } from './base.exchange';
import Decimal from 'decimal.js';

/**
 * Tokocrypto Exchange Integration
 * Binance Cloud partner — API is Binance-compatible with IDR pairs.
 * Docs: https://www.tokocrypto.com/apidocs/
 */
export class TokocryptoExchange extends BaseExchange {
  readonly name = 'TOKOCRYPTO';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor() {
    super();
    this.baseUrl = env.TOKOCRYPTO_BASE_URL;
    this.apiKey = env.TOKOCRYPTO_API_KEY || '';
    this.apiSecret = env.TOKOCRYPTO_API_SECRET || '';
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
    // pair: BTCIDR, ETHIDR, USDTIDR (no underscore for Tokocrypto)
    const symbol = pair.replace('_', '');
    const response = await axios.get(`${this.baseUrl}/open/v1/market/ticker/bookTicker`, {
      params: { symbol },
    });

    const data = response.data as { data: { bidPrice: string; askPrice: string } };
    return {
      pair,
      bidPrice: new Decimal(data.data.bidPrice),
      askPrice: new Decimal(data.data.askPrice),
      timestamp: new Date(),
    };
  }

  async createMarketSellOrder(params: SellOrderParams): Promise<OrderResult> {
    const symbol = params.pair.replace('_', '');
    const timestamp = Date.now();
    const queryParams = { symbol, side: 'SELL', type: 'MARKET', quantity: params.quantity.toString(), timestamp };
    const signedQuery = this.signQuery(queryParams);

    const response = await axios.post(
      `${this.baseUrl}/open/v1/orders?${signedQuery}`,
      null,
      { headers: this.headers() },
    );

    const order = response.data as { data: { orderId: number; status: string; executedQty: string; cummulativeQuoteQty: string; fills: Array<{ commission: string }> } };
    const filled = new Decimal(order.data.executedQty);
    const quoteQty = new Decimal(order.data.cummulativeQuoteQty);
    const fee = order.data.fills?.reduce((acc, f) => acc.add(f.commission), new Decimal(0)) ?? new Decimal(0);

    return {
      orderId: String(order.data.orderId),
      status: 'FILLED',
      filledQty: filled,
      avgPrice: filled.gt(0) ? quoteQty.div(filled) : new Decimal(0),
      fee,
      idrTotal: quoteQty,
    };
  }

  async getOrderById(orderId: string, pair?: string): Promise<OrderResult> {
    const symbol = pair?.replace('_', '') || '';
    const timestamp = Date.now();
    const signedQuery = this.signQuery({ symbol, orderId, timestamp });

    const response = await axios.get(`${this.baseUrl}/open/v1/orders/detail?${signedQuery}`, {
      headers: this.headers(),
    });

    const order = response.data as { data: { orderId: number; status: string; executedQty: string; cummulativeQuoteQty: string } };
    const filled = new Decimal(order.data.executedQty);
    const quoteQty = new Decimal(order.data.cummulativeQuoteQty);

    return {
      orderId: String(order.data.orderId),
      status: order.data.status === 'FILLED' ? 'FILLED' : order.data.status === 'NEW' ? 'OPEN' : 'CANCELLED',
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

    const data = response.data as { data: { address: string } };
    if (!data.data?.address) throw new AppError(`No deposit address for ${currency}`, HttpStatus.NOT_FOUND);
    return data.data.address;
  }
}
