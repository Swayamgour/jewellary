import { createSlice } from '@reduxjs/toolkit';

const token = localStorage.getItem('token');
let user = null;
let branch = null;

try {
  const savedUser = localStorage.getItem('user');
  if (savedUser) user = JSON.parse(savedUser);
  const savedBranch = localStorage.getItem('branch');
  if (savedBranch) branch = JSON.parse(savedBranch);
} catch (e) {
  console.error('Failed to parse auth from localStorage', e);
}

const initialState = {
  user: user,
  token: token || null,
  branch: branch || (user?.branchId || null),
  isAuthenticated: Boolean(token && user),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;
      if (user?.branchId) {
        state.branch = user.branchId;
        localStorage.setItem('branch', JSON.stringify(user.branchId));
      }
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    setBranch: (state, action) => {
      state.branch = action.payload;
      localStorage.setItem('branch', JSON.stringify(action.payload));
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.branch = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('branch');
    }
  }
});

export const { setCredentials, setBranch, logout } = authSlice.actions;

export default authSlice.reducer;

export const selectCurrentUser = (state) => state.auth.user;
export const selectToken = (state) => state.auth.token;
export const selectCurrentBranch = (state) => state.auth.branch;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectUserRole = (state) => {
  const role = state.auth.user?.roleId?.name || state.auth.user?.role;
  return role || 'GUEST';
};
export const selectUserPermissions = (state) => {
  return state.auth.user?.roleId?.permissions || [];
};
