import { apiRequestGet, apiRequestDelete } from 'mastodon/api';

// Account & Security surface (Kronk-native, Phase 1): the signed-in-devices
// and recent-sign-ins reads, plus revoking one device. All three are scoped
// server-side to the current user — see
// app/controllers/api/v1/settings/{sessions,login_activities}_controller.rb.

export interface SessionActivation {
  id: string;
  current: boolean;
  browser: string;
  platform: string;
  device: 'mobile' | 'tablet' | 'desktop';
  ip: string | null;
  last_active_at: string;
}

export interface LoginActivity {
  id: string;
  authentication_method: string | null;
  success: boolean | null;
  ip: string | null;
  browser: string;
  platform: string;
  created_at: string;
}

export const fetchSessions = () =>
  apiRequestGet<SessionActivation[]>('v1/settings/sessions');

export const fetchLoginActivities = () =>
  apiRequestGet<LoginActivity[]>('v1/settings/login_activities');

export const revokeSession = (id: string) =>
  apiRequestDelete(`v1/settings/sessions/${id}`);
