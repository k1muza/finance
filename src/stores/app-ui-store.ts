'use client'

import type { TransactionKind } from '@/types'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

export type NetworkStatus = 'online' | 'offline'
export type SyncPhase = 'idle' | 'syncing' | 'failed'
export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

type DistrictIdUpdater = string | null | ((current: string | null) => string | null)

interface SyncStatusState {
  networkStatus: NetworkStatus
  syncPhase: SyncPhase
  pendingCount: number
  failedCount: number
  lastError: string | null
  lastSyncedAt: string | null
}

interface CashbookFilterDraftState {
  dateFrom: string | null
  dateTo: string | null
  kindFilter: TransactionKind | ''
  search: string
  selectedFundId: string | null
}

interface AppUiState {
  activeDistrictId: string | null
  cashbookActiveAccountIds: Record<string, string>
  cashbookFilterDraftsByDistrict: Record<string, CashbookFilterDraftState>
  toastPosition: ToastPosition
  hasHydrated: boolean
  syncStatus: SyncStatusState
  markHydrated: (value: boolean) => void
  setActiveDistrictId: (next: DistrictIdUpdater) => void
  setCashbookActiveAccountId: (districtId: string, accountId: string | null) => void
  setCashbookFilterDraft: (districtId: string, patch: Partial<CashbookFilterDraftState>) => void
  clearCashbookFilterDraft: (districtId: string) => void
  setToastPosition: (position: ToastPosition) => void
  setNetworkStatus: (status: NetworkStatus) => void
  startSync: (pendingCount?: number) => void
  completeSync: () => void
  failSync: (message: string, failedCount?: number) => void
  setPendingCount: (count: number) => void
  clearSyncError: () => void
  resetAppUiState: () => void
}

const STORAGE_KEY = 'finance-app-ui'

function getInitialNetworkStatus(): NetworkStatus {
  if (typeof window === 'undefined') return 'online'
  return window.navigator.onLine ? 'online' : 'offline'
}

function buildInitialSyncStatus(): SyncStatusState {
  return {
    networkStatus: getInitialNetworkStatus(),
    syncPhase: 'idle',
    pendingCount: 0,
    failedCount: 0,
    lastError: null,
    lastSyncedAt: null,
  }
}

function buildEmptyCashbookFilterDraft(): CashbookFilterDraftState {
  return {
    dateFrom: null,
    dateTo: null,
    kindFilter: '',
    search: '',
    selectedFundId: null,
  }
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const useAppUiStore = create<AppUiState>()(
  persist(
    (set) => ({
      activeDistrictId: null,
      cashbookActiveAccountIds: {},
      cashbookFilterDraftsByDistrict: {},
      toastPosition: 'bottom-right',
      hasHydrated: false,
      syncStatus: buildInitialSyncStatus(),
      markHydrated: (value) => set({ hasHydrated: value }),
      setActiveDistrictId: (next) =>
        set((state) => ({
          activeDistrictId: typeof next === 'function' ? next(state.activeDistrictId) : next,
        })),
      setCashbookActiveAccountId: (districtId, accountId) =>
        set((state) => {
          if (!accountId) {
            const rest = { ...state.cashbookActiveAccountIds }
            delete rest[districtId]
            return {
              cashbookActiveAccountIds: rest,
            }
          }

          return {
            cashbookActiveAccountIds: {
              ...state.cashbookActiveAccountIds,
              [districtId]: accountId,
            },
          }
        }),
      setCashbookFilterDraft: (districtId, patch) =>
        set((state) => ({
          cashbookFilterDraftsByDistrict: {
            ...state.cashbookFilterDraftsByDistrict,
            [districtId]: {
              ...(state.cashbookFilterDraftsByDistrict[districtId] ?? buildEmptyCashbookFilterDraft()),
              ...patch,
            },
          },
        })),
      clearCashbookFilterDraft: (districtId) =>
        set((state) => {
          const rest = { ...state.cashbookFilterDraftsByDistrict }
          delete rest[districtId]
          return {
            cashbookFilterDraftsByDistrict: rest,
          }
        }),
      setToastPosition: (position) => set({ toastPosition: position }),
      setNetworkStatus: (status) =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            networkStatus: status,
          },
        })),
      startSync: (pendingCount = 0) =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            syncPhase: 'syncing',
            pendingCount,
            failedCount: 0,
            lastError: null,
          },
        })),
      completeSync: () =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            syncPhase: 'idle',
            pendingCount: 0,
            failedCount: 0,
            lastError: null,
            lastSyncedAt: new Date().toISOString(),
          },
        })),
      failSync: (message, failedCount = 1) =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            syncPhase: 'failed',
            failedCount,
            lastError: message,
          },
        })),
      setPendingCount: (count) =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            pendingCount: count,
          },
        })),
      clearSyncError: () =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            syncPhase: state.syncStatus.pendingCount > 0 ? 'syncing' : 'idle',
            failedCount: 0,
            lastError: null,
          },
        })),
      resetAppUiState: () =>
        set({
          activeDistrictId: null,
          cashbookActiveAccountIds: {},
          cashbookFilterDraftsByDistrict: {},
          hasHydrated: true,
          syncStatus: buildInitialSyncStatus(),
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => (typeof window === 'undefined' ? noopStorage : window.localStorage)),
      partialize: (state) => ({
        activeDistrictId: state.activeDistrictId,
        cashbookActiveAccountIds: state.cashbookActiveAccountIds,
        cashbookFilterDraftsByDistrict: state.cashbookFilterDraftsByDistrict,
        toastPosition: state.toastPosition,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated(true)
      },
    },
  ),
)
