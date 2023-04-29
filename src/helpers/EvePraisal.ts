export interface EPPrice {
  avg: number;
  max: number;
  median: number;
  min: number;
  order_count: number;
  percentile: number;
  stddev: number;
  volume: number;
}

export interface EPItem {
  meta: {};
  name: string;
  prices: {
    all: EPPrice;
    buy: EPPrice;
    sell: EPPrice;
    strategy: string;
    updated: Date;
  };
  quantity: number;
  typeID: number;
  typeName: string;
  typeVolume: number;
}

export interface EvePraisal {
  appraisal: {
    created: number;
    items: EPItem[];
    kind: string;
    live: boolean;
    market_name: string;
    private: boolean;
    raw: string;
    totals: {
      buy: number;
      sell: number;
      volume: number;
    };
    unparsed: string | null;
  };
}
