import { beforeEach, describe, expect, it } from 'vitest'
import { useAppUiStore } from '@/stores/app-ui-store'

describe('app ui store', () => {
  beforeEach(() => {
    useAppUiStore.getState().resetAppUiState()
  })

  it('stores the active district selection in shared client state', () => {
    useAppUiStore.getState().setActiveDistrictId('district-1')

    expect(useAppUiStore.getState().activeDistrictId).toBe('district-1')
  })

  it('remembers the cashbook account per district', () => {
    useAppUiStore.getState().setCashbookActiveAccountId('district-1', 'account-a')
    useAppUiStore.getState().setCashbookActiveAccountId('district-2', 'account-b')

    expect(useAppUiStore.getState().cashbookActiveAccountIds['district-1']).toBe('account-a')
    expect(useAppUiStore.getState().cashbookActiveAccountIds['district-2']).toBe('account-b')

    useAppUiStore.getState().setCashbookActiveAccountId('district-1', null)

    expect(useAppUiStore.getState().cashbookActiveAccountIds['district-1']).toBeUndefined()
    expect(useAppUiStore.getState().cashbookActiveAccountIds['district-2']).toBe('account-b')
  })

  it('stores cashbook filter drafts per district', () => {
    useAppUiStore.getState().setCashbookFilterDraft('district-1', {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-17',
      kindFilter: 'receipt',
      search: 'tithe',
      selectedFundId: 'fund-1',
    })

    useAppUiStore.getState().setCashbookFilterDraft('district-1', {
      search: 'offering',
    })

    useAppUiStore.getState().setCashbookFilterDraft('district-2', {
      kindFilter: 'payment',
    })

    expect(useAppUiStore.getState().cashbookFilterDraftsByDistrict['district-1']).toEqual({
      dateFrom: '2026-04-01',
      dateTo: '2026-04-17',
      kindFilter: 'receipt',
      search: 'offering',
      selectedFundId: 'fund-1',
    })
    expect(useAppUiStore.getState().cashbookFilterDraftsByDistrict['district-2']).toEqual({
      dateFrom: null,
      dateTo: null,
      kindFilter: 'payment',
      search: '',
      selectedFundId: null,
    })

    useAppUiStore.getState().clearCashbookFilterDraft('district-1')

    expect(useAppUiStore.getState().cashbookFilterDraftsByDistrict['district-1']).toBeUndefined()
    expect(useAppUiStore.getState().cashbookFilterDraftsByDistrict['district-2']).toBeDefined()
  })

  it('tracks sync lifecycle separately from server-backed records', () => {
    useAppUiStore.getState().startSync(3)

    expect(useAppUiStore.getState().syncStatus.syncPhase).toBe('syncing')
    expect(useAppUiStore.getState().syncStatus.pendingCount).toBe(3)

    useAppUiStore.getState().failSync('Network unavailable', 2)

    expect(useAppUiStore.getState().syncStatus.syncPhase).toBe('failed')
    expect(useAppUiStore.getState().syncStatus.failedCount).toBe(2)
    expect(useAppUiStore.getState().syncStatus.lastError).toBe('Network unavailable')
  })

  it('completes sync and clears transient error state', () => {
    useAppUiStore.getState().startSync(1)
    useAppUiStore.getState().failSync('Retry needed', 1)
    useAppUiStore.getState().completeSync()

    const { syncStatus } = useAppUiStore.getState()

    expect(syncStatus.syncPhase).toBe('idle')
    expect(syncStatus.pendingCount).toBe(0)
    expect(syncStatus.failedCount).toBe(0)
    expect(syncStatus.lastError).toBeNull()
    expect(syncStatus.lastSyncedAt).not.toBeNull()
  })
})
