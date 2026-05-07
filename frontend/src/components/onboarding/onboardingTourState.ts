export const ONBOARDING_STORAGE_KEY = 'storyforge-onboarding-completed'

export function shouldShowOnboardingTour() {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'true'
  } catch {
    return false
  }
}

export function markOnboardingTourComplete() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
  } catch {
    // Ignore storage failures so closing the tour never blocks the app shell.
  }
}
