import { User } from './types';

export const MOCK_USERS: User[] = [
  { id: 'a0000001-0000-0000-0000-000000000001', name: 'Pei', email: 'pei@bridgecom.com.tw', isManager: false, isAdmin: true },
  { id: 'a0000002-0000-0000-0000-000000000002', name: 'David', email: 'david@bridgecom.com.tw', isManager: false },
  { id: 'a0000003-0000-0000-0000-000000000003', name: 'Sharon', email: 'sharon@bridgecom.com.tw', isManager: false },
  { id: 'a0000004-0000-0000-0000-000000000004', name: 'Jenny', email: 'jenny@bridgecom.com.tw', isManager: true, subordinates: ['a0000001-0000-0000-0000-000000000001', 'a0000002-0000-0000-0000-000000000002'] },
  { id: 'a0000005-0000-0000-0000-000000000005', name: 'Jill', email: 'jill@bridgecom.com.tw', isManager: false },
  { id: 'a0000006-0000-0000-0000-000000000006', name: 'Brian', email: 'brian@bridgecom.com.tw', isManager: true, subordinates: ['a0000003-0000-0000-0000-000000000003', 'a0000005-0000-0000-0000-000000000005'] },
  { id: 'a0000007-0000-0000-0000-000000000007', name: 'Danny', email: 'danny@bridgecom.com.tw', isManager: false },
  { id: 'a0000008-0000-0000-0000-000000000008', name: 'Nellie', email: 'nellie@bridgecom.com.tw', isManager: false },
  { id: 'a0000009-0000-0000-0000-000000000009', name: 'Ken', email: 'ken@bridgecom.com.tw', isManager: true, isAdmin: true, subordinates: ['a0000001-0000-0000-0000-000000000001', 'a0000003-0000-0000-0000-000000000003', 'a0000004-0000-0000-0000-000000000004'] },
  { id: 'a0000010-0000-0000-0000-000000000010', name: 'Tzong', email: 'tzong@bridgecom.com.tw', isManager: true, subordinates: ['a0000006-0000-0000-0000-000000000006', 'a0000009-0000-0000-0000-000000000009'] },
];

export const APP_NAME = "週計畫管理系統";
export const COMPANY_NAME = "BRIDGECOM";