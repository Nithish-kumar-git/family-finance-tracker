/**
 * Data Recovery Utility
 * Fetches all data from backend API and restores it to localStorage
 */

import { api } from './api.js'

export async function recoverDataFromBackend() {
  console.log('🔄 Starting data recovery from backend...')
  
  try {
    // Fetch all data from backend
    const [
      expenses,
      assets,
      milestones,
      employment,
      snapshots
    ] = await Promise.allSettled([
      api.expenses.getByMonth(new Date().getFullYear(), new Date().getMonth() + 1),
      api.assets.getAll(),
      api.milestones.getAll(),
      api.employment.getAll(),
      api.reports.getAllSnapshots()
    ])

    const recoveredData = {}

    // Expenses
    if (expenses.status === 'fulfilled' && expenses.value?.expenses) {
      recoveredData.expenses = expenses.value.expenses
      console.log(`✅ Recovered ${expenses.value.expenses.length} expenses`)
    }

    // Assets
    if (assets.status === 'fulfilled') {
      const assetData = assets.value
      if (assetData.fixedDeposits) {
        recoveredData.fixedDeposits = assetData.fixedDeposits
        console.log(`✅ Recovered ${assetData.fixedDeposits.length} fixed deposits`)
      }
      if (assetData.mutualFunds) {
        recoveredData.mutualFunds = assetData.mutualFunds
        console.log(`✅ Recovered ${assetData.mutualFunds.length} mutual funds`)
      }
      if (assetData.licPolicies) {
        recoveredData.licPolicies = assetData.licPolicies
        console.log(`✅ Recovered ${assetData.licPolicies.length} LIC policies`)
      }
      if (assetData.chitFunds) {
        recoveredData.chitFunds = assetData.chitFunds
        console.log(`✅ Recovered ${assetData.chitFunds.length} chit funds`)
      }
    }

    // Milestones
    if (milestones.status === 'fulfilled' && Array.isArray(milestones.value)) {
      recoveredData.milestones = milestones.value
      console.log(`✅ Recovered ${milestones.value.length} milestones`)
    }

    // Employment
    if (employment.status === 'fulfilled' && Array.isArray(employment.value)) {
      recoveredData.jobApplications = employment.value
      console.log(`✅ Recovered ${employment.value.length} job applications`)
    }

    // Snapshots
    if (snapshots.status === 'fulfilled' && Array.isArray(snapshots.value)) {
      recoveredData.monthlySnapshots = snapshots.value
      console.log(`✅ Recovered ${snapshots.value.length} monthly snapshots`)
    }

    console.log('✅ Data recovery complete!')
    console.log('Recovered data:', recoveredData)
    
    return {
      success: true,
      data: recoveredData,
      message: 'Data recovered successfully'
    }

  } catch (error) {
    console.error('❌ Data recovery failed:', error)
    return {
      success: false,
      error: error.message,
      message: 'Failed to recover data from backend'
    }
  }
}

/**
 * Restore recovered data to localStorage and reload the app
 */
export async function restoreData() {
  const result = await recoverDataFromBackend()
  
  if (result.success && result.data) {
    try {
      // Get current localStorage data
      const currentData = JSON.parse(localStorage.getItem('fft_data') || '{}')
      
      // Merge recovered data with current data
      const mergedData = {
        ...currentData,
        ...result.data
      }
      
      // Save to localStorage
      localStorage.setItem('fft_data', JSON.stringify(mergedData))
      
      console.log('✅ Data restored to localStorage')
      console.log('🔄 Reloading app...')
      
      // Reload the page to apply changes
      window.location.reload()
      
      return {
        success: true,
        message: 'Data restored successfully. Reloading app...'
      }
    } catch (error) {
      console.error('❌ Failed to restore data:', error)
      return {
        success: false,
        error: error.message,
        message: 'Failed to restore data to localStorage'
      }
    }
  }
  
  return result
}
