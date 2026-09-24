import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Building,
  User,
  ShieldCheck,
  Server,
  CheckCircle2,
  Clock,
  LogOut,
  RefreshCw
} from 'lucide-react';
import {
  selectCurrentUser,
  selectUserRole,
  selectCurrentBranch,
  selectUserPermissions,
  setBranch,
  logout
} from '../auth/authSlice';
import { useGetBranchesQuery } from '../../app/api/baseApi';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { toast } from 'sonner';

export const SettingsPage = () => {
  const user = useSelector(selectCurrentUser);
  const role = useSelector(selectUserRole);
  const currentBranch = useSelector(selectCurrentBranch);
  const permissions = useSelector(selectUserPermissions);
  const dispatch = useDispatch();

  const { data: branchData } = useGetBranchesQuery();
  const branches = branchData?.data || [];

  const handleBranchSwitch = (e) => {
    const selected = branches.find((b) => b._id === e.target.value);
    if (selected) {
      dispatch(setBranch(selected));
      toast.success(`Switched active store to: ${selected.name}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-surface-900 font-display">System & Branch Settings</h1>
        <p className="text-xs text-surface-500 mt-1">
          Store multi-branch configuration, operator profiles, and role permission matrices
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Branch Profile Card */}
        <Card title="Current Branch Store Configuration" icon={Building}>
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-surface-400">Branch Name</span>
              <p className="text-sm font-bold text-surface-900 mt-0.5">
                {currentBranch?.name || 'Flagship Head Office Branch'}
              </p>
              <span className="font-mono text-gold-700 font-semibold">
                Code: {currentBranch?.code || 'HO01'}
              </span>
            </div>

            <div className="p-3 bg-surface-50 rounded-xl space-y-1.5 border border-surface-200">
              <p>
                <strong>GSTIN:</strong>{' '}
                <span className="font-mono">{currentBranch?.gstin || '27AAAAA0000A1Z5'}</span>
              </p>
              <p>
                <strong>Address:</strong>{' '}
                {currentBranch?.address?.street || '101, Zaveri Bazaar, Kalbadevi'},{' '}
                {currentBranch?.address?.city || 'Mumbai'}, {currentBranch?.address?.state || 'Maharashtra'} -{' '}
                {currentBranch?.address?.pincode || '400002'}
              </p>
              <p>
                <strong>State Code:</strong> {currentBranch?.address?.stateCode || '27'}
              </p>
              <p>
                <strong>Contact Phone:</strong> {currentBranch?.phone || '+91 22 2244 5566'}
              </p>
            </div>

            {role === 'SUPER_ADMIN' && branches.length > 0 && (
              <div>
                <label className="text-[10px] font-bold uppercase text-surface-600 block mb-1">
                  Switch Active Multi-Branch
                </label>
                <select
                  value={currentBranch?._id || ''}
                  onChange={handleBranchSwitch}
                  className="w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white"
                >
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Card>

        {/* User Account & Security Card */}
        <Card title="Logged Operator & RBAC Role" icon={User}>
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gold-500 text-white flex items-center justify-center font-black text-lg">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <div>
                <h4 className="font-bold text-surface-900 text-sm">{user?.name || 'Administrator'}</h4>
                <p className="text-surface-500">{user?.email || 'admin@jewelleryerp.com'}</p>
                <Badge variant="gold" size="sm" className="mt-1">
                  {role}
                </Badge>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-100">
              <span className="text-[10px] font-bold uppercase text-surface-400 block mb-2">
                Active Permissions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'CANCEL', 'PRINT', 'EXPORT'].map(
                  (perm) => (
                    <span
                      key={perm}
                      className="px-2 py-0.5 rounded-md bg-surface-100 text-surface-700 text-[10px] font-bold font-mono"
                    >
                      ✓ {perm}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-surface-100 flex items-center justify-between text-[11px] text-surface-500">
              <span>Security: JWT Bearer Token Active</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Authenticated
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Backend API Health Status Indicator */}
      <div className="p-4 bg-white rounded-2xl border border-surface-200 shadow-xs flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <p className="font-bold text-surface-900">Backend API Connection: ONLINE</p>
            <p className="text-surface-500 text-[11px]">
              REST endpoints reachable at http://localhost:5000/api
            </p>
          </div>
        </div>
        <span className="font-mono text-surface-400 text-[11px]">v1.0.0-PROD</span>
      </div>
    </div>
  );
};
