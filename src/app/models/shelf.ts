export interface Shelf {
  id: number;
  name: string;
  maxWeight: number;
  minThreshold: number;
  currentWeight: number;
}

export interface ShelfRequest {
  name: string;
  maxWeight: number;
  minThreshold: number;
}
