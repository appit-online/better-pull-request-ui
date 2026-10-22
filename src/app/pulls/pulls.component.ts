import { Component, OnInit } from '@angular/core';
const electron = (window as any).require('electron');
import { NgZone } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

interface PrGroup {
  title: string;
  items: any[];
  expanded: boolean;
}

@Component({
  selector: 'app-pulls',
  templateUrl: './pulls.component.html',
  styleUrls: ['./pulls.component.scss']
})
export class PullsComponent implements OnInit {
  pullRequests: any[] = [];
  groupedPullRequests: PrGroup[] = [];
  isLoading = false;

  constructor(private zone: NgZone, private toastr: ToastrService) { }

  ngOnInit(): void {
    this.getPullRequests();
    electron.ipcRenderer.on('pullRequests', (event: any, pullRequests: any) => {
      if (pullRequests && pullRequests.search && pullRequests.search.edges) {
        this.zone.run(() => {
          this.isLoading = false;
          this.pullRequests = pullRequests.search.edges;
          this.computeGroups();
        });
      } else {
        this.zone.run(() => {
          this.isLoading = false;
          this.toastr.error('Check your settings and your internet connection', 'Could not load pull requests');
        });
      }
    });
  }

  private computeGroups(): void {
    const map = new Map<string, any[]>();
    for (const pr of this.pullRequests) {
      const title = pr?.node?.title || '—';
      if (!map.has(title)) { map.set(title, []); }
      map.get(title)!.push(pr);
    }
    this.groupedPullRequests = Array.from(map.entries()).map(([title, items]) => ({
      title,
      items,
      expanded: false,
    }));
  }

  // tslint:disable-next-line:typedef
  toggleGroup(group: PrGroup) {
    group.expanded = !group.expanded;
  }

  // tslint:disable-next-line:typedef
  openUrl(event: any, targetUrl: any) {
    event.stopPropagation();
    electron.ipcRenderer.send('openUrl', targetUrl);
  }

  // tslint:disable-next-line:typedef
  getPullRequests() {
    this.pullRequests = [];
    this.groupedPullRequests = [];
    this.isLoading = true;
    electron.ipcRenderer.send('getPullRequests');
  }

  // tslint:disable-next-line:typedef
  asImg(t: EventTarget | null) { return t as HTMLImageElement; }

  getInitial(login: string): string {
    return (login || '?').charAt(0).toUpperCase();
  }

  getStatusClass(state: string): string {
    switch (state) {
      case 'SUCCESS': return 'badge-success';
      case 'FAILED':
      case 'FAILURE': return 'badge-danger';
      case 'RUNNING': return 'badge-warning';
      case 'PENDING':
      case 'CREATED':
      case 'WAITING_FOR_RESOURCE':
      case 'PREPARING': return 'badge-info';
      case 'CANCELED':
      case 'SKIPPED': return 'badge-secondary';
      default: return 'badge-secondary';
    }
  }
}
