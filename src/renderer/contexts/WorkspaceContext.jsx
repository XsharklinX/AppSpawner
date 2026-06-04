import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from './ToastContext';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const toast = useToast();
  const [workspaces, setWorkspaces] = useState([]);
  const [profiles,   setProfiles]   = useState([]);

  const loadWorkspaces = useCallback(async () => {
    try {
      const [ws, pr] = await Promise.all([
        window.electronAPI?.getWorkspaces() ?? [],
        window.electronAPI?.getProfiles()   ?? [],
      ]);
      setWorkspaces(ws);
      setProfiles(pr);
    } catch {}
  }, []);

  useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);

  // ── Workspaces ────────────────────────────────────────────────────────────

  const createWorkspace = useCallback(async (config) => {
    const ws = await window.electronAPI?.createWorkspace(config);
    if (ws) setWorkspaces(prev => [...prev, ws]);
    return ws;
  }, []);

  const updateWorkspace = useCallback(async (id, updates) => {
    const updated = await window.electronAPI?.updateWorkspace(id, updates);
    if (updated) setWorkspaces(prev => prev.map(w => w.id === id ? updated : w));
    return updated;
  }, []);

  const deleteWorkspace = useCallback(async (id) => {
    await window.electronAPI?.deleteWorkspace(id);
    setWorkspaces(prev => prev.filter(w => w.id !== id));
  }, []);

  const assignWorkspace = useCallback(async (appId, workspaceId) => {
    await window.electronAPI?.assignWorkspace(appId, workspaceId);
  }, []);

  // ── Profiles ──────────────────────────────────────────────────────────────

  const createProfile = useCallback(async (config) => {
    const p = await window.electronAPI?.createProfile(config);
    if (p) setProfiles(prev => [...prev, p]);
    return p;
  }, []);

  const updateProfile = useCallback(async (id, updates) => {
    const updated = await window.electronAPI?.updateProfile(id, updates);
    if (updated) setProfiles(prev => prev.map(p => p.id === id ? updated : p));
    return updated;
  }, []);

  const deleteProfile = useCallback(async (id) => {
    await window.electronAPI?.deleteProfile(id);
    setProfiles(prev => prev.filter(p => p.id !== id));
  }, []);

  return (
    <WorkspaceContext.Provider value={{
      workspaces, profiles,
      loadWorkspaces,
      createWorkspace, updateWorkspace, deleteWorkspace, assignWorkspace,
      createProfile,   updateProfile,   deleteProfile,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaces() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspaces debe usarse dentro de <WorkspaceProvider>');
  return ctx;
}
