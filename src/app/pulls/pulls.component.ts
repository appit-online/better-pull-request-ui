import { Component, OnInit } from '@angular/core';
const electron = (window as any).require('electron');
import { NgZone } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-pulls',
  templateUrl: './pulls.component.html',
  styleUrls: ['./pulls.component.scss']
})
export class PullsComponent implements OnInit {
  pullRequests: any[] = [];

  constructor(private zone: NgZone, private toastr: ToastrService) { }

  ngOnInit(): void {
    this.getPullRequests();
    electron.ipcRenderer.on('pullRequests', (event: any, pullRequests: any) => {
      if (pullRequests && pullRequests.search && pullRequests.search.edges){
        this.zone.run(() => {
          this.pullRequests = pullRequests.search.edges;
        });
      }else{
        this.zone.run(() => {
          this.toastr.error('Check your settings and your internet connection', 'Could not load pull requests');
        });
      }
    });
  }

  // tslint:disable-next-line:typedef
  openUrl(event: any, targetUrl: any) {
    electron.ipcRenderer.send('openUrl', targetUrl);
  }

  // tslint:disable-next-line:typedef
  getPullRequests() {
    this.pullRequests = [];
    electron.ipcRenderer.send('getPullRequests');
  }
}
