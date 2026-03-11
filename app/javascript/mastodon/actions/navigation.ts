import { createAction } from '@reduxjs/toolkit';

export const openNavigation = createAction('navigation/open');

export const closeNavigation = createAction('navigation/close');

export const toggleNavigation = createAction('navigation/toggle');

export const collapseNavigation = createAction('navigation/collapse');

export const expandNavigation = createAction('navigation/expand');

export const toggleCollapse = createAction('navigation/toggleCollapse');
