import Decimal from 'decimal.js';

export interface PriceData {
  pair: string;
  bidPrice: Decimal;
  askPrice: Decimal;
  timestamp: Date;
}

export interface SellOrderParams {
  pair: string;   // e.g. "BTC_IDR", "BTCIDR"
  quantity: Decimal;
}

export interface OrderResult {
  orderId: string;
  status: 'OPEN' | 'FILLED' | 'CANCELLED' | 'PARTIAL';
  filledQty: Decimal;
  avgPrice: Decimal;
  fee: Decimal;
  idrTotal: Decimal;
}

export interface QuoteResult {
  provider: string;
  pair: string;
  cryptoAmount: Decimal;
  idrGross: Decimal;
  exchangeFee: Decimal;
  idrNet: Decimal;
  rate: Decimal;
}

export abstract class BaseExchange {
  abstract readonly name: string;

  abstract getPrice(pair: string): Promise<PriceData>;
  abstract createMarketSellOrder(params: SellOrderParams): Promise<OrderResult>;
  abstract getOrderById(orderId: string, pair?: string): Promise<OrderResult>;
  abstract getDepositAddress(currency: string, network: string): Promise<string>;

  /**
   * Build a quote without placing an order.
   * Uses bid price (what buyers are willing to pay).
   */
  async getQuote(pair: string, cryptoAmount: Decimal): Promise<QuoteResult> {
    const price = await this.getPrice(pair);
    const idrGross = cryptoAmount.mul(price.bidPrice);
    const exchangeFee = idrGross.mul(0.001); // default 0.1% taker fee
    const idrNet = idrGross.sub(exchangeFee);

    return {
      provider: this.name,
      pair,
      cryptoAmount,
      idrGross,
      exchangeFee,
      idrNet,
      rate: price.bidPrice,
    };
  }

  protected buildPair(base: string, quote = 'IDR'): string {
    return `${base}_${quote}`;
  }
}
