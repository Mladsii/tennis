import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {authApi} from '../api/auth';
import {usersApi} from '../api/users';
import {User, RegisterData} from '../types/user';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (phone, password) => {
    const {data} = await authApi.login(phone, password);
    await AsyncStorage.setItem('access_token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    const {data: user} = await usersApi.getMe();
    set({user, isAuthenticated: true});
  },

  register: async (registerData) => {
    await authApi.register(registerData);
    // Auto-login after registration
    const {data} = await authApi.login(registerData.phone_primary, registerData.password);
    await AsyncStorage.setItem('access_token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    const {data: user} = await usersApi.getMe();
    set({user, isAuthenticated: true});
  },

  logout: async () => {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    set({user: null, isAuthenticated: false});
  },

  loadUser: async () => {
    try {
      const {data: user} = await usersApi.getMe();
      set({user});
    } catch {}
  },

  setUser: (user: User) => set({user}),

  checkAuth: async () => {
    set({isLoading: true});
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        set({isAuthenticated: false, isLoading: false});
        return;
      }
      const {data: user} = await usersApi.getMe();
      set({user, isAuthenticated: true, isLoading: false});
    } catch {
      set({isAuthenticated: false, isLoading: false});
    }
  },
}));
