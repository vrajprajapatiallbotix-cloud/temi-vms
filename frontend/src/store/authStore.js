import { create } from 'zustand';
import api from '../api/axios';

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('vms_user') || 'null'),
  token: localStorage.getItem('vms_token') || null,
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('vms_token', data.token);
      localStorage.setItem('vms_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false });
      return data.user;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('vms_token');
    localStorage.removeItem('vms_user');
    set({ user: null, token: null });
  },

  setUser: (user) => {
    localStorage.setItem('vms_user', JSON.stringify(user));
    set({ user });
  },
}));

export default useAuthStore;
