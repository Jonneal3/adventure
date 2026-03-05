"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { createClientComponent } from "@/config/supabase";
import type { Database } from "@/supabase/types";

type Instance = Database['public']['Tables']['instances']['Row'];

interface InstancesState {
  instances: Instance[];
  loading: boolean;
  error: string | null;
}

type InstancesAction =
  | { type: 'SET_INSTANCES'; payload: Instance[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'UPDATE_INSTANCE'; payload: { id: string; updates: Partial<Instance> } }
  | { type: 'ADD_INSTANCE'; payload: Instance }
  | { type: 'DELETE_INSTANCE'; payload: string };

const initialState: InstancesState = {
  instances: [],
  loading: false,
  error: null,
};

const InstancesContext = createContext<{
  state: InstancesState;
  loadInstances: () => Promise<void>;
  updateInstance: (id: string, updates: Partial<Instance>) => Promise<void>;
  addInstance: (instance: Instance) => void;
  deleteInstance: (id: string) => Promise<void>;
} | null>(null);

function instancesReducer(state: InstancesState, action: InstancesAction): InstancesState {
  switch (action.type) {
    case 'SET_INSTANCES':
      return { ...state, instances: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'UPDATE_INSTANCE':
      return {
        ...state,
        instances: state.instances.map((instance) =>
          instance.id === action.payload.id
            ? { ...instance, ...action.payload.updates }
            : instance
        ),
      };
    case 'ADD_INSTANCE':
      return {
        ...state,
        instances: [...state.instances, action.payload],
      };
    case 'DELETE_INSTANCE':
      return {
        ...state,
        instances: state.instances.filter((instance) => instance.id !== action.payload),
      };
    default:
      return state;
  }
}

export function InstancesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(instancesReducer, initialState);
  const supabase = createClientComponent();

  const loadInstances = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const { data: instances, error } = await supabase
        .from('instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      dispatch({ type: 'SET_INSTANCES', payload: instances });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load instances' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [supabase]);

  const updateInstance = useCallback(async (id: string, updates: Partial<Instance>) => {
    try {
      const { error } = await supabase
        .from('instances')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      dispatch({ type: 'UPDATE_INSTANCE', payload: { id, updates } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update instance' });
    }
  }, [supabase]);

  const addInstance = useCallback((instance: Instance) => {
    dispatch({ type: 'ADD_INSTANCE', payload: instance });
  }, []);

  const deleteInstance = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('instances')
        .delete()
        .eq('id', id);

      if (error) throw error;
      dispatch({ type: 'DELETE_INSTANCE', payload: id });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete instance' });
    }
  }, [supabase]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  return (
    <InstancesContext.Provider value={{ state, loadInstances, updateInstance, addInstance, deleteInstance }}>
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