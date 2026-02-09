export interface StoreStock {
  id: number;
  productId: number;
  shelfId: number;
  quantity: number;
  lastUpdated: string;
}

export interface StoreStockWithDetails extends StoreStock {
  productName: string;
  productBarcode: string;
  shelfName: string;
  unitWeight: number;
}
