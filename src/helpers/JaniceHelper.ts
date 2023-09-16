export interface JaniceAppraisal {
  id: number;
  created: Date;
  expires: Date;
  datasetTime: Date;
  code: string | null;
  designation: string;
  pricing: string;
  pricingVariant: string;
  pricePercentage: number;
  comment: string | null;
  isCompactized: boolean;
  input: string | null;
  failures: string | null;
  market: {
    id: number;
    name: string | null;
  };
  totalVolume: number;
  totalPackagedVolume: number;
  effectivePrices: JanicePrices;
  immediatePrices: JanicePrices;
  top5AveragePrices: JanicePrices;
  items: [];
}

export interface JanicePrices {
  totalBuyPrice: number;
  totalSplitPrice: number;
  totalSellPrice: number;
}

export interface PricerItem {
  immediatePrices: PricerItemValues;
  itemType: JaniceItemType;
}

export interface JaniceItemType {
  eid: number;
  name: string;
  volume: number;
  packagedVolume: number;
}

export interface PricerItemValues {
  buyPrice: number;
  splitPrice: number;
  sellPrice: number;
  buyPrice5DayMedian: number;
  splitPrice5DayMedian: number;
  sellPrice5DayMedian: number;
  buyPrice30DayMedian: number;
  splitPrice30DayMedian: number;
  sellPrice30DayMedian: number;
}

export function formatISKValue(isk: number): string {
  let value = "0 ISK";
  if (isk >= 1000000000) {
    value = Math.round(isk / 100000000) / 10 + "B ISK";
  } else if (isk >= 1000000) {
    value = Math.round(isk / 100000) / 10 + "M ISK";
  } else if (isk >= 1000) {
    value = Math.round(isk / 100) / 10 + "k ISK";
  }
  return value;
}
