"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

interface Instance {
  id: string;
  name: string;
  description: string | null;
  config?: any;
  created_at: string | null;
  updated_at: string | null;
  user_id: string | null;
  slug: string;
  is_public: boolean | null;
  submission_limit_enabled: boolean;
  max_submissions_per_session: number;
  website_url?: string | null;
  company_summary?: string | null;
  webhook_url: string | null;
  instance_type?: 'ecomm' | 'service';
  email_lead_price?: number | null;
  phone_lead_price?: number | null;
}

interface InstancesState {
  instances: Instance[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

type InstancesAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_INSTANCES'; payload: Instance[] }
  | { type: 'ADD_INSTANCE'; payload: Instance }
  | { type: 'UPDATE_INSTANCE'; payload: { id: string; updates: Partial<Instance> } }
  | { type: 'DELETE_INSTANCE'; payload: string }
  | { type: 'SET_INITIALIZED'; payload: boolean };

const initialState: InstancesState = {
  instances: [],
  loading: false,
  error: null,
  initialized: false,
};

function instancesReducer(state: InstancesState, action: InstancesAction): InstancesState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_INSTANCES':
      return { ...state, instances: action.payload, initialized: true };
    case 'ADD_INSTANCE':
      return { ...state, instances: [...state.instances, action.payload] };
    case 'UPDATE_INSTANCE':
      return {
        ...state,
        instances: state.instances.map(instance =>
          instance.id === action.payload.id
            ? { ...instance, ...action.payload.updates }
            : instance
        ),
      };
    case 'DELETE_INSTANCE':
      return {
        ...state,
        instances: state.instances.filter(instance => instance.id !== action.payload),
      };
    case 'SET_INITIALIZED':
      return { ...state, initialized: action.payload };
    default:
      return state;
  }
}

const InstancesContext = createContext<{
  instances: Instance[];
  loading: boolean;
  error: string | null;
  loadInstances: () => Promise<void>;
  refetch: () => Promise<void>;
  addInstance: (instance: Instance) => void;
  updateInstance: (id: string, updates: Partial<Instance>) => void;
  deleteInstance: (id: string) => void;
} | null>(null);

export function InstancesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(instancesReducer, initialState);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadInstances = useCallback(async () => {
    if (state.initialized && !state.loading) {
      // Already loaded and not currently loading, skip
      return;
    }

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const { data: instances, error } = await supabase
        .from('instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      dispatch({ type: 'SET_INSTANCES', payload: instances || [] });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load instances' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.initialized, state.loading]);

  const refetch = useCallback(async () => {
    // Force reload by resetting initialized state
    dispatch({ type: 'SET_INITIALIZED', payload: false });
    await loadInstances();
  }, [loadInstances]);

  const addInstance = useCallback((instance: Instance) => {
    dispatch({ type: 'ADD_INSTANCE', payload: instance });
  }, []);

  const updateInstance = useCallback((id: string, updates: Partial<Instance>) => {
    dispatch({ type: 'UPDATE_INSTANCE', payload: { id, updates } });
  }, []);

  const deleteInstance = useCallback((id: string) => {
    dispatch({ type: 'DELETE_INSTANCE', payload: id });
  }, []);

  // Load instances once when the provider mounts
  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  return (
    <InstancesContext.Provider
      value={{
        instances: state.instances,
        loading: state.loading,
        error: state.error,
        loadInstances,
        refetch,
        addInstance,
        updateInstance,
        deleteInstance,
      }}
    >
      {children}
    </InstancesContext.Provider>
  );
}

export function useInstances() {
  const context = useContext(InstancesContext);
  if (!context) {
    throw new Error('useInstances must be used within an InstancesProvider');
  }
  return context;
} 