import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [{
  path: '',
  loadChildren: () => import('./pulls/pulls.module').then(m => m.PullsModule)
}, {
  path: 'home',
  loadChildren: () => import('./pulls/pulls.module').then(m => m.PullsModule)
}, {
  path: 'settings',
  loadChildren: () => import('./settings/settings.module').then(m => m.SettingsModule)
}];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
