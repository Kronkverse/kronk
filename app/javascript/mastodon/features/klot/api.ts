import api from 'mastodon/api';

import type {
  KlotPeriod,
  KlotSettings,
  KlotShare,
  KlotPhase,
} from './types';

export async function fetchPeriods(): Promise<KlotPeriod[]> {
  const res = await api().get<KlotPeriod[]>('/api/v1/klot/periods');
  return res.data;
}

export async function createPeriod(startedOn: string): Promise<KlotPeriod> {
  const res = await api().post<KlotPeriod>('/api/v1/klot/periods', {
    started_on: startedOn,
  });
  return res.data;
}

export async function deletePeriod(id: string): Promise<void> {
  await api().delete(`/api/v1/klot/periods/${id}`);
}

export async function fetchSettings(): Promise<KlotSettings> {
  const res = await api().get<KlotSettings>('/api/v1/klot/settings');
  return res.data;
}

export async function updateSettings(
  patch: Partial<Pick<KlotSettings, 'cycle_length' | 'period_length'>>,
): Promise<KlotSettings> {
  const res = await api().patch<KlotSettings>('/api/v1/klot/settings', patch);
  return res.data;
}

export async function fetchShares(): Promise<KlotShare[]> {
  const res = await api().get<KlotShare[]>('/api/v1/klot/shares');
  return res.data;
}

export async function createShareByAcct(acct: string): Promise<KlotShare> {
  const res = await api().post<KlotShare>('/api/v1/klot/shares', { acct });
  return res.data;
}

export async function deleteShare(id: string): Promise<void> {
  await api().delete(`/api/v1/klot/shares/${id}`);
}

export async function fetchPhase(accountId: string): Promise<KlotPhase> {
  const res = await api().get<KlotPhase>(`/api/v1/klot/phases/${accountId}`);
  return res.data;
}
