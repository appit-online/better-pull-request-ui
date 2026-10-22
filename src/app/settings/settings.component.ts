import { Component, OnInit } from '@angular/core';
const electron = (window as any).require('electron');
import { NgZone } from '@angular/core';
import {ToastrService} from 'ngx-toastr';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  settings = {
    provider: 'github',
    hostname: '',
    apiToken: '',
    orgName: '',
    autoRotateToken: false,
    rotateBufferDays: 2,
  };

  tokenExpiresAt: string = '';
  tokenDaysLeft: number | null = null;

  constructor(private zone: NgZone, private toastr: ToastrService) { }

  ngOnInit(): void {
    electron.ipcRenderer.on('updatedSettings', (event: any, success: any) => {
      if (success) {
        this.zone.run(() => {
          this.toastr.success('', 'Settings saved');
          if (this.settings.provider === 'gitlab') {
            electron.ipcRenderer.send('getTokenInfo');
          }
        });
      } else {
        this.zone.run(() => {
          this.toastr.error('Please try again', 'Error');
        });
      }
    });

    electron.ipcRenderer.on('receivedSettings', (event: any, persistedSettings: any) => {
      if (persistedSettings !== false) {
        this.zone.run(() => {
          this.settings = {
            provider: 'github',
            hostname: '',
            apiToken: '',
            orgName: '',
            autoRotateToken: false,
            rotateBufferDays: 2,
            ...persistedSettings,
          };
          if (this.settings.provider === 'gitlab') {
            electron.ipcRenderer.send('getTokenInfo');
          }
        });
      }
    });

    electron.ipcRenderer.on('tokenInfo', (event: any, info: any) => {
      this.zone.run(() => {
        if (info) {
          this.tokenExpiresAt = info.expiresAt || '';
          this.tokenDaysLeft = info.daysLeft;
        } else {
          this.tokenExpiresAt = '';
          this.tokenDaysLeft = null;
        }
      });
    });

    electron.ipcRenderer.on('tokenRotated', (event: any, data: any) => {
      this.zone.run(() => {
        this.settings.apiToken = data.newToken;
        this.tokenExpiresAt = data.expiresAt || '';
        if (data.expiresAt) {
          this.tokenDaysLeft = Math.floor(
            (new Date(data.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
        }
        this.toastr.success('Token renewed and saved automatically', 'Token rotated');
      });
    });

    electron.ipcRenderer.on('tokenExpired', (event: any) => {
      this.zone.run(() => {
        this.toastr.error('Token expired — please create a new one in GitLab and paste it here', 'Token expired');
      });
    });

    this.getSettings();
  }

  // tslint:disable-next-line:typedef
  updateSettings() {
    if (this.settings.hostname.length > 0 && this.settings.apiToken.length > 0) {
      electron.ipcRenderer.send('updateSettings', this.settings);
    } else {
      this.zone.run(() => {
        this.toastr.error('Please enter all the settings', 'Error');
      });
    }
  }

  // tslint:disable-next-line:typedef
  getSettings() {
    electron.ipcRenderer.send('getSettings');
  }
}
