import { createReducer } from '@reduxjs/toolkit';

import {
  openNavigation,
  closeNavigation,
  toggleNavigation,
  toggleCollapse,
  collapseNavigation,
  expandNavigation,
} from 'mastodon/actions/navigation';

interface State {
  open: boolean;
  collapsed: boolean;
}

const initialState: State = {
  open: false,
  collapsed: localStorage.getItem('navCollapsed') === '1',
};

export const navigationReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(openNavigation, (state) => {
      state.open = true;
    })
    .addCase(closeNavigation, (state) => {
      state.open = false;
    })
    .addCase(toggleNavigation, (state) => {
      state.open = !state.open;
    })
    .addCase(collapseNavigation, (state) => {
      state.collapsed = true;
      localStorage.setItem('navCollapsed', '1');
    })
    .addCase(expandNavigation, (state) => {
      state.collapsed = false;
      localStorage.setItem('navCollapsed', '0');
    })
    .addCase(toggleCollapse, (state) => {
      state.collapsed = !state.collapsed;
      localStorage.setItem('navCollapsed', state.collapsed ? '1' : '0');
    });
});
