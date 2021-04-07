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
  settings = {hostname: '', apiToken: '', orgName: ''};

  constructor(private zone: NgZone, private toastr: ToastrService) { }

  ngOnInit(): void {
    electron.ipcRenderer.on('updatedSettings', (event: any, success: any) => {
      if (success){
        this.zone.run(() => {
          this.toastr.success('', 'Settings saved');
        });
      }else{
        this.zone.run(() => {
          this.toastr.error('Please try again', 'Error');
        });
      }
    });
    electron.ipcRenderer.on('receivedSettings', (event: any, persistedSettings: any) => {
      if (persistedSettings !== false){
        this.zone.run(() => {
          this.settings = persistedSettings;
        });
      }
    });

    this.getSettings();
  }

  // tslint:disable-next-line:typedef
  updateSettings() {
    if (this.settings.hostname.length > 0 &&  this.settings.apiToken.length > 0 ){
      electron.ipcRenderer.send('updateSettings', this.settings);
    }else{
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
