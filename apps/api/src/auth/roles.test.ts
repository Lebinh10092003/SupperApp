import test from 'node:test';
import assert from 'node:assert/strict';
import { can } from './roles.js';

test('principal no infra', () => assert.equal(can('PRINCIPAL', 'MANAGE_INFRASTRUCTURE'), false));
test('admin infra', () => assert.equal(can('SYSTEM_ADMIN', 'MANAGE_INFRASTRUCTURE'), true));
test('super admin has all', () => {
  assert.equal(can('SYSTEM_SUPER_ADMIN', 'MANAGE_INFRASTRUCTURE'), true);
  assert.equal(can('SYSTEM_SUPER_ADMIN', 'MANAGE_CONNECTIONS'), true);
  assert.equal(can('SYSTEM_SUPER_ADMIN', 'MANAGE_CATALOG'), true);
  assert.equal(can('SYSTEM_SUPER_ADMIN', 'MANAGE_USERS'), true);
});
test('school admin can manage connections and catalog', () => {
  assert.equal(can('SCHOOL_ADMIN', 'MANAGE_CONNECTIONS'), true);
  assert.equal(can('SCHOOL_ADMIN', 'MANAGE_CATALOG'), true);
  assert.equal(can('SCHOOL_ADMIN', 'MANAGE_INFRASTRUCTURE'), false);
});
test('teacher has student data but no executive bi or infra', () => {
  assert.equal(can('TEACHER', 'VIEW_DASHBOARD'), true);
  assert.equal(can('TEACHER', 'VIEW_STUDENT_DATA'), true);
  assert.equal(can('TEACHER', 'VIEW_EXECUTIVE_BI'), false);
  assert.equal(can('TEACHER', 'MANAGE_USERS'), false);
  assert.equal(can('TEACHER', 'MANAGE_INFRASTRUCTURE'), false);
});
test('department head has student data and alerts but no infra', () => {
  assert.equal(can('DEPARTMENT_HEAD', 'VIEW_DASHBOARD'), true);
  assert.equal(can('DEPARTMENT_HEAD', 'VIEW_STUDENT_DATA'), true);
  assert.equal(can('DEPARTMENT_HEAD', 'RESOLVE_ALERTS'), true);
  assert.equal(can('DEPARTMENT_HEAD', 'MANAGE_INFRASTRUCTURE'), false);
  assert.equal(can('DEPARTMENT_HEAD', 'MANAGE_USERS'), false);
});
test('data viewer is read-only dashboard', () => {
  assert.equal(can('DATA_VIEWER', 'VIEW_DASHBOARD'), true);
  assert.equal(can('DATA_VIEWER', 'VIEW_EXECUTIVE_BI'), false);
  assert.equal(can('DATA_VIEWER', 'RESOLVE_ALERTS'), false);
  assert.equal(can('DATA_VIEWER', 'MANAGE_USERS'), false);
});