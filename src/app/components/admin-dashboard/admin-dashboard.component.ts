import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminDashboardService, DashboardStats, RfidEventWithProduct } from '../../services/admin-dashboard.service';
import { Product, ProductWithStock, ProductRegisterRequest, RfidWsMessage } from '../../models/product';
import { Shelf, ShelfRequest } from '../../models/shelf';
import { Alert } from '../../models/alert';
import { StoreStockWithDetails } from '../../models/store-stock';

@Component({
  selector: 'app-admin-dashboard',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent implements OnInit {
  private readonly dashboardService = inject(AdminDashboardService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private alertToastTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly stats = signal<DashboardStats | null>(null);
  readonly recentEvents = signal<RfidEventWithProduct[]>([]);
  readonly isLoadingStats = signal(false);
  readonly isLoadingEvents = signal(false);

  readonly storeStock = signal<StoreStockWithDetails[]>([]);
  readonly isLoadingStoreStock = signal(false);

  readonly products = signal<ProductWithStock[]>([]);
  readonly isLoadingProducts = signal(false);
  readonly isLoadingDelete = signal<number | null>(null);
  readonly isLoadingDeleteEvent = signal<number | null>(null);

  readonly shelves = signal<Shelf[]>([]);
  readonly isLoadingShelves = signal(false);
  readonly isLoadingDeleteShelf = signal<number | null>(null);
  readonly isShelfFormOpen = signal(false);
  readonly isSavingShelf = signal(false);
  readonly shelfFormMode = signal<'add' | 'edit'>('add');
  readonly editingShelfId = signal<number | null>(null);

  readonly alerts = signal<Alert[]>([]);
  readonly isLoadingAlerts = signal(false);
  readonly isResolvingAlert = signal<number | null>(null);
  readonly openAlertsCount = signal(0);
  readonly alertToast = signal<{ message: string; alert: Alert } | null>(null);

  readonly isFormOpen = signal(false);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly currentLocation = signal<'STOCK' | 'STORE' | null>(null);
  readonly formMode = signal<'new_rfid' | 'add_product' | 'edit_product'>('add_product');
  readonly editingProductId = signal<number | null>(null);

  readonly selectedView = signal<'home' | 'stock' | 'store' | 'products' | 'shelves' | 'alerts'>('home');

  readonly productForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    barcode: ['', [Validators.required, Validators.maxLength(64)]],
    rfidTag: ['', [Validators.required, Validators.maxLength(128)]],
    description: ['', [Validators.maxLength(500)]],
    unitWeight: [0.001, [Validators.required, Validators.min(0.001)]]
  });

  readonly shelfForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    maxWeight: [0, [Validators.required, Validators.min(0.1)]],
    minThreshold: [0, [Validators.required, Validators.min(0.1)]]
  });

  ngOnInit(): void {
    this.loadDashboardData();
    this.dashboardService.connectRfidWs();
    this.dashboardService.rfidEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.handleRfidEvent(event));

    this.dashboardService.alerts$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(alert => this.handleNewAlert(alert));

    this.dashboardService.goHome$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.goBack());
  }

  loadDashboardData(): void {
    this.loadStats();
    this.loadRecentEvents();
    this.loadAlerts();
  }

  loadStats(): void {
    this.isLoadingStats.set(true);
    this.dashboardService
      .getStats()
      .pipe(
        finalize(() => this.isLoadingStats.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          console.log('📊 Stats reçues du backend:', JSON.stringify(response.data, null, 2));
          console.log('Stock Principal (totalStock):', response.data.totalStock);
          this.stats.set(response.data);
        },
        error: (err) => {
          console.error('Error loading stats:', err);
        }
      });
  }

  loadRecentEvents(): void {
    this.isLoadingEvents.set(true);
    this.dashboardService
      .getRecentEventsWithProduct(15)
      .pipe(
        finalize(() => this.isLoadingEvents.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.recentEvents.set(response.data);
        },
        error: (err) => {
          console.error('Error loading events:', err);
        }
      });
  }

  loadEventsByLocation(location: 'STOCK' | 'STORE'): void {
    this.isLoadingEvents.set(true);
    this.dashboardService
      .getRecentEventsWithProduct(30)
      .pipe(
        finalize(() => this.isLoadingEvents.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          const filteredEvents = response.data.filter(event => event.location === location);
          this.recentEvents.set(filteredEvents);
        },
        error: (err) => {
          console.error('Error loading events:', err);
        }
      });
  }

  refreshCurrentLocationEvents(): void {
    if (this.selectedView() === 'stock') {
      this.loadEventsByLocation('STOCK');
    } else if (this.selectedView() === 'store') {
      this.loadEventsByLocation('STORE');
    }
  }

  loadStoreStock(): void {
    this.isLoadingStoreStock.set(true);
    this.dashboardService
      .getStoreStock()
      .pipe(
        finalize(() => this.isLoadingStoreStock.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.storeStock.set(response.data);
        },
        error: (err) => {
          console.error('Error loading store stock:', err);
        }
      });
  }

  handleRfidEvent(event: RfidWsMessage): void {
    if (event.type === 'NEW_PRODUCT' && event.location === 'STOCK') {
      this.openProductForm(event.rfidTag, event.location);
    }
    // Reload events after RFID event
    this.loadRecentEvents();
    // Reload stats and shelves when weight changes (ENTRY/EXIT events)
    if (event.type === 'ENTRY' || event.type === 'EXIT') {
      this.loadStats();
      this.loadShelves();
    }
  }

  openProductForm(rfidTag: string, location: 'STOCK' | 'STORE'): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.currentLocation.set(location);
    this.formMode.set('new_rfid');
    this.editingProductId.set(null);
    this.productForm.reset({
      name: '',
      barcode: '',
      rfidTag,
      description: '',
      unitWeight: 0.001
    });
    this.isFormOpen.set(true);
  }

  openAddProductForm(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.currentLocation.set(null);
    this.formMode.set('add_product');
    this.editingProductId.set(null);
    this.productForm.reset({
      name: '',
      barcode: '',
      rfidTag: '',
      description: '',
      unitWeight: 0.001
    });
    this.isFormOpen.set(true);
  }

  openEditProductForm(product: Product): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.currentLocation.set(null);
    this.formMode.set('edit_product');
    this.editingProductId.set(product.id);
    this.productForm.reset({
      name: product.name,
      barcode: product.barcode,
      rfidTag: product.rfidTag,
      description: product.description,
      unitWeight: product.unitWeight
    });
    this.isFormOpen.set(true);
  }

  closeProductForm(): void {
    this.isFormOpen.set(false);
  }

  submitProduct(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const rawValue = this.productForm.getRawValue();
    const payload: ProductRegisterRequest = {
      name: rawValue.name.trim(),
      barcode: rawValue.barcode.trim(),
      rfidTag: rawValue.rfidTag.trim(),
      description: rawValue.description?.trim() || '',
      unitWeight: Number(rawValue.unitWeight),
      esp32Id: 'ESP32_STOCK'
    };

    console.log('Sending payload:', JSON.stringify(payload, null, 2));

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.formMode() === 'edit_product' && this.editingProductId()) {
      this.dashboardService
        .updateProduct(this.editingProductId()!, payload)
        .pipe(finalize(() => this.isSaving.set(false)))
        .subscribe({
          next: () => {
            this.successMessage.set('Produit modifié avec succès!');
            setTimeout(() => {
              this.closeProductForm();
              this.loadProducts();
            }, 1500);
          },
          error: (err) => {
            console.error('Error updating product:', err);
            this.errorMessage.set(
              err.error?.message || 'Erreur lors de la modification du produit'
            );
          }
        });
    } else {
      this.dashboardService
        .registerProduct(payload)
        .pipe(finalize(() => this.isSaving.set(false)))
        .subscribe({
          next: (response) => {
            console.log('Product created:', response);
            this.successMessage.set('Produit enregistré avec succès!');
            setTimeout(() => {
              this.closeProductForm();
              this.loadStats();
              this.loadRecentEvents();
              if (this.selectedView() === 'products') {
                this.loadProducts();
              }
            }, 1500);
          },
          error: (err) => {
            console.error('Product registration error:', err);
            console.error('Error details:', {
              status: err?.status,
              statusText: err?.statusText,
              message: err?.error?.message,
              body: err?.error
            });
            const errorMsg = err?.error?.message || err?.statusText || 'Erreur lors de l\'enregistrement du produit';
            this.errorMessage.set(errorMsg);
          }
        });
    }
  }

  loadProducts(): void {
    this.isLoadingProducts.set(true);
    this.dashboardService
      .getProductsWithStock()
      .pipe(
        finalize(() => this.isLoadingProducts.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.products.set(response.data);
        },
        error: (err) => {
          console.error('Error loading products:', err);
        }
      });
  }

  deleteProduct(product: Product): void {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le produit "${product.name}"?`)) {
      return;
    }

    this.isLoadingDelete.set(product.id);
    this.dashboardService
      .deleteProduct(product.id)
      .pipe(
        finalize(() => this.isLoadingDelete.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.successMessage.set('Produit supprimé avec succès!');
          this.loadProducts();
          this.loadStats();
          setTimeout(() => this.successMessage.set(null), 3000);
        },
        error: (err) => {
          console.error('Error deleting product:', err);
          this.errorMessage.set(
            err.error?.message || 'Erreur lors de la suppression du produit'
          );
          setTimeout(() => this.errorMessage.set(null), 3000);
        }
      });
  }

  deleteEvent(event: RfidEventWithProduct): void {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer cet événement?`)) {
      return;
    }

    this.isLoadingDeleteEvent.set(event.id);
    this.dashboardService
      .deleteEvent(event.id)
      .pipe(
        finalize(() => this.isLoadingDeleteEvent.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.loadRecentEvents();
          this.loadStats();
        },
        error: (err) => {
          console.error('Error deleting event:', err);
          alert(err.error?.message || 'Erreur lors de la suppression de l\'événement');
        }
      });
  }

  getEventIcon(eventType: string, location: string): string {
    if (eventType === 'ENTRY') {
      return location === 'STOCK' ? '📥' : '📦';
    }
    return location === 'STOCK' ? '📤' : '🛒';
  }

  getEventLabel(eventType: string, location: string): string {
    if (eventType === 'ENTRY') {
      return location === 'STOCK' ? 'Entrée Stock' : 'Entrée Magasin';
    }
    return location === 'STOCK' ? 'Sortie Stock' : 'Sortie Magasin';
  }

  // Shelf management methods
  loadShelves(): void {
    this.isLoadingShelves.set(true);
    this.dashboardService
      .getShelves()
      .pipe(
        finalize(() => this.isLoadingShelves.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.shelves.set(response.data);
        },
        error: (err) => {
          console.error('Error loading shelves:', err);
        }
      });
  }

  openAddShelfForm(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.shelfFormMode.set('add');
    this.editingShelfId.set(null);
    this.shelfForm.reset({
      name: '',
      maxWeight: 0,
      minThreshold: 0
    });
    this.isShelfFormOpen.set(true);
  }

  openEditShelfForm(shelf: Shelf): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.shelfFormMode.set('edit');
    this.editingShelfId.set(shelf.id);
    this.shelfForm.reset({
      name: shelf.name,
      maxWeight: shelf.maxWeight,
      minThreshold: shelf.minThreshold
    });
    this.isShelfFormOpen.set(true);
  }

  closeShelfForm(): void {
    this.isShelfFormOpen.set(false);
  }

  submitShelf(): void {
    if (this.shelfForm.invalid) {
      this.shelfForm.markAllAsTouched();
      return;
    }

    const rawValue = this.shelfForm.getRawValue();
    const payload: ShelfRequest = {
      name: rawValue.name.trim(),
      maxWeight: Number(rawValue.maxWeight),
      minThreshold: Number(rawValue.minThreshold)
    };

    this.isSavingShelf.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.shelfFormMode() === 'edit' && this.editingShelfId()) {
      this.dashboardService
        .updateShelf(this.editingShelfId()!, payload)
        .pipe(finalize(() => this.isSavingShelf.set(false)))
        .subscribe({
          next: () => {
            this.successMessage.set('Étagère modifiée avec succès!');
            setTimeout(() => {
              this.closeShelfForm();
              this.loadShelves();
            }, 1500);
          },
          error: (err) => {
            console.error('Error updating shelf:', err);
            this.errorMessage.set(
              err.error?.message || 'Erreur lors de la modification de l\'étagère'
            );
          }
        });
    } else {
      this.dashboardService
        .createShelf(payload)
        .pipe(finalize(() => this.isSavingShelf.set(false)))
        .subscribe({
          next: () => {
            this.successMessage.set('Étagère créée avec succès!');
            setTimeout(() => {
              this.closeShelfForm();
              this.loadShelves();
            }, 1500);
          },
          error: (err) => {
            console.error('Error creating shelf:', err);
            this.errorMessage.set(
              err.error?.message || 'Erreur lors de la création de l\'étagère'
            );
          }
        });
    }
  }

  deleteShelf(shelf: Shelf): void {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'étagère "${shelf.name}"?`)) {
      return;
    }

    this.isLoadingDeleteShelf.set(shelf.id);
    this.dashboardService
      .deleteShelf(shelf.id)
      .pipe(
        finalize(() => this.isLoadingDeleteShelf.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.successMessage.set('Étagère supprimée avec succès!');
          this.loadShelves();
          setTimeout(() => this.successMessage.set(null), 3000);
        },
        error: (err) => {
          console.error('Error deleting shelf:', err);
          this.errorMessage.set(
            err.error?.message || 'Erreur lors de la suppression de l\'étagère'
          );
          setTimeout(() => this.errorMessage.set(null), 3000);
        }
      });
  }

  loadAlerts(): void {
    this.isLoadingAlerts.set(true);
    this.dashboardService
      .getOpenAlerts()
      .pipe(
        finalize(() => this.isLoadingAlerts.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (alerts) => {
          this.alerts.set(alerts);
          this.openAlertsCount.set(alerts.length);
        },
        error: (err) => {
          console.error('Error loading alerts:', err);
        }
      });
  }

  handleNewAlert(alert: Alert): void {
    // Add new alert to the list
    this.alerts.update(current => [alert, ...current]);
    this.openAlertsCount.update(count => count + 1);

    const message = alert.alertType === 'LOW_WEIGHT'
      ? `Remplir l'etagere: ${alert.shelfName}`
      : `Nouvelle alerte: ${alert.alertType}`;
    this.showAlertToast({ message, alert });
    
    // Reload shelves on weight alerts to update current weight
    if (alert.alertType === 'LOW_WEIGHT' || alert.alertType === 'OVERLOAD') {
      this.loadShelves();
    }
  }

  showAlertToast(payload: { message: string; alert: Alert }): void {
    if (this.alertToastTimeout) {
      clearTimeout(this.alertToastTimeout);
    }

    this.alertToast.set(payload);
    this.alertToastTimeout = setTimeout(() => {
      this.alertToast.set(null);
      this.alertToastTimeout = null;
    }, 10000);
  }

  dismissAlertToast(): void {
    if (this.alertToastTimeout) {
      clearTimeout(this.alertToastTimeout);
      this.alertToastTimeout = null;
    }
    this.alertToast.set(null);
  }

  goToAlertsFromToast(): void {
    this.dismissAlertToast();
    this.selectView('alerts');
  }

  resolveAlert(alert: Alert): void {
    if (!confirm(`Marquer l'alerte "${alert.shelfName}" comme résolue?`)) {
      return;
    }

    this.isResolvingAlert.set(alert.id);
    this.dashboardService
      .resolveAlert(alert.id)
      .pipe(
        finalize(() => this.isResolvingAlert.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.successMessage.set('Alerte résolue avec succès!');
          this.loadAlerts();
          setTimeout(() => this.successMessage.set(null), 3000);
        },
        error: (err) => {
          console.error('Error resolving alert:', err);
          this.errorMessage.set('Erreur lors de la résolution de l\'alerte');
          setTimeout(() => this.errorMessage.set(null), 3000);
        }
      });
  }

  selectView(view: 'home' | 'stock' | 'store' | 'products' | 'shelves' | 'alerts'): void {
    this.selectedView.set(view);
    if (view === 'stock') {
      this.loadEventsByLocation('STOCK');
    } else if (view === 'store') {
      this.loadStoreStock();
    } else if (view !== 'home') {
      this.loadRecentEvents();
    }
    if (view === 'products') {
      this.loadProducts();
    }
    if (view === 'shelves') {
      this.loadShelves();
    }
    if (view === 'alerts') {
      this.loadAlerts();
    }
  }

  goBack(): void {
    this.selectedView.set('home');
  }
}
