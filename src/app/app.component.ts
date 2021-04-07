import { Component } from '@angular/core';
const electron = (window as any).require('electron');
import { NgZone } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  userData: any;
  dateYear;
  constructor(private zone: NgZone) {
    this.getUser();
    this.dateYear = new Date().getFullYear();

    electron.ipcRenderer.on('userData', (event: any, userData: any) => {
      if (userData !== false){
        this.zone.run(() => {
          this.userData = userData.data;
        });
      }
    });
  }

  // tslint:disable-next-line:typedef
  getUser() {
    electron.ipcRenderer.send('getUser');
  }

  // tslint:disable-next-line:typedef
  openUrl(event: any, targetUrl: any) {
    electron.ipcRenderer.send('openUrl', targetUrl);
  }
}
