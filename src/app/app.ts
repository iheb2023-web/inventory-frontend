import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminDashboardService } from './services/admin-dashboard.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('inventory-frontend');
  private readonly dashboardService = inject(AdminDashboardService);

  goToDashboard(): void {
    console.log('Returning to home...');
    this.dashboardService.triggerGoHome();
  }
}
