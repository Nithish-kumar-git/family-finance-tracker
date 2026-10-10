// Temporarily fail closed. The former recovery source was incomplete and could
// return local fallback data; it must not replace stored records or reload.
export const RESTORE_UNAVAILABLE_MESSAGE =
  'Restoration is temporarily unavailable because the current recovery source cannot guarantee a complete, validated backup. Existing data has not been changed.'

function disabledRecoveryResult() {
  return {
    success: false,
    disabled: true,
    error: 'RECOVERY_DISABLED',
    message: RESTORE_UNAVAILABLE_MESSAGE,
  }
}

// Keep both async entry points safe for existing or programmatic callers.
export async function recoverDataFromBackend() {
  return disabledRecoveryResult()
}

export async function restoreData() {
  return disabledRecoveryResult()
}
