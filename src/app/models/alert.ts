export interface Alert {
  id: number;
  shelfId: number;
  shelfName: string;
  productId?: number;
  productName?: string;
  alertType: string;
  status: string;
  createdAt: string;
}
