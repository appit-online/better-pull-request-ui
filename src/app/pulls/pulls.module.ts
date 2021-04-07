import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PullsComponent } from './pulls.component';
import {RouterModule, Routes} from '@angular/router';


const routes: Routes = [
  {
    path: '',
    component: PullsComponent
  }
];

@NgModule({
  declarations: [PullsComponent],
  imports: [
    RouterModule.forChild(routes),
    CommonModule
  ]
})
export class PullsModule { }
