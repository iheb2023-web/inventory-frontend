export interface Product {
  id: number;
  name: string;
  barcode: string;
  rfidTag: string;
  description: string;
  unitWeight: number;
  unitPrice: number;
  createdAt: string;
}

export interface ProductWithStock extends Product {
  stockQuantity: number;
}

export interface ProductRegisterRequest {
  name: string;
  barcode: string;
  rfidTag: string;
  description: string;
  unitWeight: number;
  unitPrice: number;
  esp32Id?: string;
}

export interface RfidWsMessage {
  type: string;
  rfidTag: string;
  location: 'STOCK' | 'STORE' | string;
}
