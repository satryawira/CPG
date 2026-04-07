import axios from 'axios';
import crypto from 'crypto';
import { env } from '@/config/env';
import { AppError, HttpStatus } from '@/utils/AppError';
import { BaseExchange, PriceData, SellOrderParams, OrderResult } from './base.exchange';
import Decimal from 'decimal.js';

/**
 * OKX Exchange Integration
 * REST API v5: https://www.okx.com/docs-v5/en/
 * Auth: OK-ACCESS-KEY, OK-ACCESS-SIGN (HMAC-SHA256), OK-ACCESS-TIMESTAMP, OK-ACCESS-PASSPHRASE
 */
export class OkxExchange extends BaseExchange {
  readonly name = 'OKX';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly passphrase: string;

  constructor() {
    super();
    this.baseUrl = env.OKX_BASE_URL;
    this.apiKey = env.OKX_API_KEY || '';
    this.apiSecret = env.OKX_API_SECRET || '';
    this.passphrase = env.OKX_PASSPHRASE || '';
  }

  private sign(timestamp: string, method: string, path: string, body = ''): string {
    const prehash = `${timestamp}${method}${path}${body}`;
    return crypto.createHmac('sha256', this.apiSecret).update(prehash).digest('base64');
  }

  private headers(method: string, path: string, body = '') {
    const timestamp = new Date().toISOString();
    return {
      'OK-ACCESS-KEY': this.apiKey,
      'OK-ACCESS-SIGN': this.sign(timestamp, method, path, body),
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': this.passphrase,
      'Content-Type': 'application/json',
    };
  }

  async getPrice(pair: string): Promise<PriceData> {
    // OKX instId format: BTC-USDT
    const instId = pair.replace('_', '-');
    const response = await axios.get(`${this.baseUrl}/api/v5/market/books`, {
      params: { instId, sz: '1' },
    });

    const data = response.data as { data: Array<{ bids: Array<[string]>; asks: Array<[string]> }> };
    const book = data.data[0];

    return {
      pair,
      bidPrice: new Decimal(book.bids[0][0]),
      askPrice: new Decimal(book.asks[0][0]),
      timestamp: new Date(),
    };
  }

  async createMarketSellOrder(params: SellOrderParams): Promise<OrderResult> {
    const instId = params.pair.replace('_', '-');
    const path = '/api/v5/trade/order';
    const body = JSON.stringify({ instId, tdMode: 'cash', side: 'sell', ordType: 'market', sz: params.quantity.toString() });

    const response = await axios.post(`${this.baseUrl}${path}`, body, {
      headers: this.headers('POST', path, body),
    });

    const result = response.data as { data: Array<{ ordId: string; sCode: string; sMsg: string }> };
    if (result.data[0].sCode !== '0') {
      throw new AppError(`OKX order error: ${result.data[0].sMsg}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Order placed; fetch details for fill info
    const orderId = result.data[0].ordId;
    return this.getOrderById(orderId, params.pair);
  }

  async getOrderById(orderId: string, pair?: string): Promise<OrderResult> {
    const instId = pair?.replace('_', '-') || '';
    const path = `/api/v5/trade/order?instId=${instId}&ordId=${orderId}`;

    const response = await axios.get(`${this.baseUrl}${path}`, {
      headers: this.headers('GET', path),
    });

    const data = response.data as { data: Array<{ ordId: string; state: string; fillSz: string; avgPx: string; fee: string; fillNotionalUsd: string }> };
    const order = data.data[0];

    const statusMap: Record<string, OrderResult['status']> = {
      filled: 'FILLED', live: 'OPEN', canceled: 'CANCELLED', 'partially_filled': 'PARTIAL',
    };

    const filled = new Decimal(order.fillSz || '0');
    const avgPx = new Decimal(order.avgPx || '0');

    return {
      orderId: order.ordId,
      status: statusMap[order.state] || 'OPEN',
      filledQty: filled,
      avgPrice: avgPx,
      fee: new Decimal(order.fee || '0').abs(),
      idrTotal: filled.mul(avgPx),
    };
  }

  async getDepositAddress(currency: string, network: string): Promise<string> {
    const path = `/api/v5/asset/deposit-address?ccy=${currency}`;
    const response = await axios.get(`${this.baseUrl}${path}`, {
      headers: this.headers('GET', path),
    });

    const data = response.data as { data: Array<{ addr: string; chain: string }> };
    const match = data.data.find((d) => d.chain.toLowerCase().includes(network.toLowerCase()));

    if (!match) throw new AppError(`No deposit address for ${currency} on ${network}`, HttpStatus.NOT_FOUND);
    return match.addr;
  }
}
