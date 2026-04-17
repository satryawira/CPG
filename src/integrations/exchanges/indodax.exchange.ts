import axios from 'axios';
import { env } from '@/config/env';
import { hmacSha512 } from '@/utils/crypto.util';
import { AppError, HttpStatus } from '@/utils/AppError';
import { BaseExchange, PriceData, SellOrderParams, OrderResult } from './base.exchange';
import Decimal from 'decimal.js';

/**
 * Indodax Exchange Integration
 * Docs: https://indodax.com/downloads/INDODAXCOM-apiv2.pdf
 * Supports native IDR pairs: BTC_IDR, ETH_IDR, USDT_IDR, etc.
 */
export class IndodaxExchange extends BaseExchange {
  readonly name = 'INDODAX';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor() {
    super();
    this.baseUrl = env.INDODAX_BASE_URL;
    this.apiKey = env.INDODAX_API_KEY || '';
    this.apiSecret = env.INDODAX_API_SECRET || '';
  }

  private async callPrivate(method: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const nonce = Date.now();
    const body = new URLSearchParams({ method, nonce: String(nonce), ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    const sign = hmacSha512(body.toString(), this.apiSecret);

    const response = await axios.post(this.baseUrl, body.toString(), {
      headers: { Key: this.apiKey, Sign: sign, 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = response.data as { success: number; error?: string; return?: unknown };
    if (data.success !== 1) {
      throw new AppError(`Indodax error: ${data.error}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return data.return;
  }

  async getPrice(pair: string): Promise<PriceData> {
    // pair format: btc_idr → ticker endpoint is public
    const normalizedPair = pair.toLowerCase().replace('_', '_');
    const response = await axios.get(`https://indodax.com/api/${normalizedPair}/ticker`);
    const ticker = (response.data as { ticker: { buy: string; sell: string } }).ticker;

    return {
      pair,
      bidPrice: new Decimal(ticker.buy),
      askPrice: new Decimal(ticker.sell),
      timestamp: new Date(),
    };
  }

  async createMarketSellOrder(params: SellOrderParams): Promise<OrderResult> {
    const [base] = params.pair.split('_');
    const pairLower = params.pair.toLowerCase();

    const result = await this.callPrivate('trade', {
      pair: pairLower,
      type: 'sell',
      [`${base.toLowerCase()}`]: params.quantity.toString(),
    }) as { order_id: string; receive_idr: string; spend_coin: string; remain_coin: string; fee: string };

    return {
      orderId: result.order_id,
      status: 'FILLED',
      filledQty: params.quantity,
      avgPrice: new Decimal(result.receive_idr).div(params.quantity),
      fee: new Decimal(result.fee || '0'),
      idrTotal: new Decimal(result.receive_idr),
    };
  }

  async getOrderById(orderId: string, pair?: string): Promise<OrderResult> {
    const result = await this.callPrivate('getOrder', {
      order_id: orderId,
      pair: pair?.toLowerCase() || '',
    }) as { order: { order_id: string; status: string; price: string; order_coin: string; remain_coin: string; receive_idr: string } };

    const order = result.order;
    const filledQty = new Decimal(order.order_coin).sub(order.remain_coin || '0');

    return {
      orderId: order.order_id,
      status: order.status === 'filled' ? 'FILLED' : order.status === 'open' ? 'OPEN' : 'CANCELLED',
      filledQty,
      avgPrice: new Decimal(order.price),
      fee: new Decimal(0),
      idrTotal: new Decimal(order.receive_idr || '0'),
    };
  }

  async getDepositAddress(currency: string, _network: string): Promise<string> {
    const result = await this.callPrivate('getInfo') as { balance: Record<string, string>; address: Record<string, string> };
    const address = result.address?.[currency.toLowerCase()];

    if (!address) throw new AppError(`No deposit address found for ${currency} on Indodax`, HttpStatus.NOT_FOUND);
    return address;
  }
}
