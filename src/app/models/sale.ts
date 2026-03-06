export interface SaleTransactionDto {
  transactionDate: string;
  items: SaleItemDto[];
  totalQuantity: number;
  totalPrice: number;
}

export interface SaleItemDto {
  saleId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}
