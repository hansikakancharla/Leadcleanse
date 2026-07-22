import React from 'react';
import { Shield, CheckCircle, XCircle, Clock, UserMinus, UserCheck } from 'lucide-react';
import { syncUserToDatabase, type DummyUser } from '../utils/db';

interface AdminUserManagementProps {
  users: DummyUser[];
  setUsers: React.Dispatch<React.SetStateAction<DummyUser[]>>;
  currentUser: DummyUser;
  showToast: (message: string, type: 'success' | 'info' | 'error' | 'warning') => void;
}

export default function AdminUserManagement({
  users,
  setUsers,
  currentUser,
  showToast,
}: AdminUserManagementProps) {
  const handleUpdateStatus = (email: string, status: 'approved' | 'pending' | 'rejected') => {
    // Prevent modifying own user
    if (email.toLowerCase() === currentUser.email.toLowerCase()) {
      showToast('You cannot change your own approval status.', 'error');
      return;
    }

    const updated = users.map((u) => {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        const updatedUser = { ...u, status };
        syncUserToDatabase(updatedUser);
        return updatedUser;
      }
      return u;
    });

    setUsers(updated);
    localStorage.setItem('datacleanse_users', JSON.stringify(updated));
    showToast(`User ${email} status updated to ${status}.`, 'success');
  };

  const pendingCount = users.filter((u) => u.status === 'pending').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
      <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-violet-650" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 text-sm">Access Control & Approvals</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review, approve, and manage system access credentials
            </p>
          </div>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/60 rounded-full text-xs font-bold text-amber-700 animate-pulse self-start sm:self-auto">
            <Clock size={12} />
            <span>{pendingCount} Pending Review</span>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pl-3">User Profile</th>
                <th className="pb-3">Company & Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70 text-xs">
              {users.map((user) => {
                const isSelf = user.email.toLowerCase() === currentUser.email.toLowerCase();
                const status = user.status || 'approved';

                return (
                  <tr key={user.email} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-3.5 pl-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200/60">
                          {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            {user.name}
                            {isSelf && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-550 border border-slate-200 rounded text-[9px] font-semibold">
                                You
                              </span>
                            )}
                            {user.isAdmin && (
                              <span className="px-1.5 py-0.5 bg-violet-50 text-violet-750 border border-violet-100 rounded text-[9px] font-bold flex items-center gap-0.5">
                                <Shield size={8} /> Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5">
                      <div className="font-semibold text-slate-700">{user.role}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{user.company}</div>
                    </td>
                    <td className="py-3.5">
                      {status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full font-bold text-[10px]">
                          <CheckCircle size={10} /> Approved
                        </span>
                      )}
                      {status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full font-bold text-[10px]">
                          <Clock size={10} /> Pending
                        </span>
                      )}
                      {status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 border border-red-200/60 rounded-full font-bold text-[10px]">
                          <XCircle size={10} /> Rejected
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-right pr-3">
                      {isSelf ? (
                        <span className="text-[10px] text-slate-400 font-semibold italic">System Protected</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(user.email, 'approved')}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition-colors shadow-sm active:scale-95"
                              >
                                <UserCheck size={11} /> Approve
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(user.email, 'rejected')}
                                className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 font-bold rounded-lg text-[10px] transition-all active:scale-95"
                              >
                                <UserMinus size={11} /> Reject
                              </button>
                            </>
                          )}
                          {status === 'approved' && (
                            <button
                              onClick={() => handleUpdateStatus(user.email, 'rejected')}
                              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-red-50 text-slate-600 hover:text-red-650 border border-slate-200 hover:border-red-200/60 font-bold rounded-lg text-[10px] transition-all active:scale-95"
                            >
                              <UserMinus size={11} /> Revoke
                            </button>
                          )}
                          {status === 'rejected' && (
                            <button
                              onClick={() => handleUpdateStatus(user.email, 'approved')}
                              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-750 border border-slate-200 hover:border-emerald-200/60 font-bold rounded-lg text-[10px] transition-all active:scale-95"
                            >
                              <UserCheck size={11} /> Re-approve
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
