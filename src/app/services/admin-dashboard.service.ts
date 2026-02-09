import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';
import { ProductWithStock, Product, ProductRegisterRequest, RfidWsMessage } from '../models/product';
import { Shelf, ShelfRequest } from '../models/shelf';
import { Alert } from '../models/alert';
import { StoreStockWithDetails } from '../models/store-stock';

export interface DashboardStats {
  totalProducts: number;
  totalStock: number;
  totalStoreStock: number;
  totalShelves: number;
}

export interface RfidEventWithProduct {
  id: number;
  productId: number;
  productName: string;
  eventType: 'ENTRY' | 'EXIT';
  location: 'STOCK' | 'STORE';
  esp32Id: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminDashboardService {
  private readonly http = inject(HttpClient);
  private readonly rfidEventsSubject = new Subject<RfidWsMessage>();
  private readonly alertsSubject = new Subject<Alert>();
  private readonly goHomeSubject = new Subject<void>();
  private readonly apiBaseUrl = 'http://localhost:8080';
  private stompClient: Client | null = null;
  private connected = false;

  readonly rfidEvents$ = this.rfidEventsSubject.asObservable();
  readonly alerts$ = this.alertsSubject.asObservable();
  readonly goHome$ = this.goHomeSubject.asObservable();

  getStats(): Observable<{ success: boolean; message: string; data: DashboardStats }> {
    return this.http.get<{ success: boolean; message: string; data: DashboardStats }>(`${this.apiBaseUrl}/api/rfid/stats`);
  }

  getRecentEventsWithProduct(limit: number = 20): Observable<{ success: boolean; message: string; data: RfidEventWithProduct[] }> {
    return this.http.get<{ success: boolean; message: string; data: RfidEventWithProduct[] }>(`${this.apiBaseUrl}/api/rfid/events/recent-with-product?limit=${limit}`);
  }

  getStoreStock(): Observable<{ success: boolean; message: string; data: StoreStockWithDetails[] }> {
    return this.http.get<{ success: boolean; message: string; data: StoreStockWithDetails[] }>(`${this.apiBaseUrl}/api/store-stock`);
  }

  getProductsWithStock(): Observable<{ success: boolean; message: string; data: ProductWithStock[] }> {
    return this.http.get<{ success: boolean; message: string; data: ProductWithStock[] }>(`${this.apiBaseUrl}/api/products/with-stock`);
  }

  registerProduct(payload: ProductRegisterRequest): Observable<Product> {
    return this.http.post<Product>(`${this.apiBaseUrl}/api/products`, payload);
  }

  updateProduct(id: number, payload: ProductRegisterRequest): Observable<Product> {
    return this.http.put<Product>(`${this.apiBaseUrl}/api/products/${id}`, payload);
  }

  deleteProduct(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiBaseUrl}/api/products/${id}`);
  }

  deleteEvent(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiBaseUrl}/api/rfid/${id}`);
  }

  // Shelf methods
  getShelves(): Observable<{ success: boolean; message: string; data: Shelf[] }> {
    return this.http.get<{ success: boolean; message: string; data: Shelf[] }>(`${this.apiBaseUrl}/api/shelf`);
  }

  createShelf(payload: ShelfRequest): Observable<{ success: boolean; message: string; data: Shelf }> {
    return this.http.post<{ success: boolean; message: string; data: Shelf }>(`${this.apiBaseUrl}/api/shelf`, payload);
  }

  updateShelf(id: number, payload: ShelfRequest): Observable<{ success: boolean; message: string; data: Shelf }> {
    return this.http.put<{ success: boolean; message: string; data: Shelf }>(`${this.apiBaseUrl}/api/shelf/${id}`, payload);
  }

  deleteShelf(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiBaseUrl}/api/shelf/${id}`);
  }

  // Alert methods
  getOpenAlerts(): Observable<Alert[]> {
    return this.http.get<Alert[]>(`${this.apiBaseUrl}/api/alerts/open`);
  }

  resolveAlert(id: number): Observable<void> {
    return this.http.put<void>(`${this.apiBaseUrl}/api/alerts/${id}/resolve`, {});
  }

  // Sale methods
  getProductByBarcode(barcode: string): Observable<{ success: boolean; message: string; data: ProductWithStock }> {
    return this.http.get<{ success: boolean; message: string; data: ProductWithStock }>(`${this.apiBaseUrl}/api/products/barcode/${barcode}`);
  }

  recordSale(productId: number, quantity: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiBaseUrl}/api/sales`, { productId, quantity });
  }

  recordMultipleSale(items: Array<{ productId: number; quantity: number }>): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiBaseUrl}/api/sales/multiple`, { items });
  }

  connectRfidWs(): void {
    if (this.connected || this.stompClient) {
      return;
    }

    const client = new Client({
      reconnectDelay: 5000,
      webSocketFactory: () => new SockJS(`${this.apiBaseUrl}/ws`)
    });

    client.onConnect = () => {
      this.connected = true;
      client.subscribe('/topic/rfid', message => this.handleRfidMessage(message));
      client.subscribe('/topic/alerts', message => this.handleAlertMessage(message));
    };

    client.onDisconnect = () => {
      this.connected = false;
    };

    client.onStompError = () => {
      this.connected = false;
    };

    this.stompClient = client;
    client.activate();
  }

  private handleRfidMessage(message: IMessage): void {
    if (!message.body) {
      return;
    }

    try {
      const payload = JSON.parse(message.body) as RfidWsMessage;
      if (payload?.type && payload?.rfidTag) {
        this.rfidEventsSubject.next(payload);
      }
    } catch {
      // Ignore invalid payloads
    }
  }

  private handleAlertMessage(message: IMessage): void {
    if (!message.body) {
      return;
    }

    try {
      const alert = JSON.parse(message.body) as Alert;
      if (alert?.id) {
        this.alertsSubject.next(alert);
      }
    } catch {
      // Ignore invalid payloads
    }
  }

  triggerGoHome(): void {
    this.goHomeSubject.next();
  }
}
