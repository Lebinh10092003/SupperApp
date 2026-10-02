/**
 * api.ts (contacts) — client gọi `/api/contacts/*` (xem
 * apps/api/src/modules/identity/contacts.routes.ts). Nhóm chỉ lưu
 * `perId`, KHÔNG có tên/email/SĐT — tra thêm qua `fetchContactDetails`
 * (gọi lại `/api/safety/people/contact` có sẵn, không trùng lặp dữ liệu).
 */
import { api } from '../../services/api';

export interface ContactGroup {
  groupId: string;
  name: string;
  scope: 'personal' | 'school';
  mine: boolean;
  perIds: string[];
}

export interface ContactDetail {
  perId: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export function listContactGroups() {
  return api.get<{ results: ContactGroup[] }>('/api/contacts/groups').then((r) => r.results);
}

export function createContactGroup(name: string, scope: 'personal' | 'school') {
  return api.post<ContactGroup>('/api/contacts/groups', { name, scope });
}

export function renameContactGroup(groupId: string, name: string) {
  return api.patch<{ ok: true }>(`/api/contacts/groups/${groupId}`, { name });
}

export function deleteContactGroup(groupId: string) {
  return api.delete<{ ok: true }>(`/api/contacts/groups/${groupId}`);
}

export function addContactGroupMember(groupId: string, perId: string) {
  return api.post<{ ok: true }>(`/api/contacts/groups/${groupId}/members`, { perId });
}

export function removeContactGroupMember(groupId: string, perId: string) {
  return api.delete<{ ok: true }>(`/api/contacts/groups/${groupId}/members/${perId}`);
}

export function fetchContactDetails(perIds: string[]): Promise<Record<string, ContactDetail>> {
  if (perIds.length === 0) return Promise.resolve({});
  return api
    .get<{ results: ContactDetail[] }>(`/api/safety/people/contact?perIds=${encodeURIComponent(perIds.join(','))}`)
    .then((r) => Object.fromEntries((r.results || []).map((c) => [c.perId, c])));
}
