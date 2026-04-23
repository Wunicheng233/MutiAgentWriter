import axios from 'axios'

interface ErrorResponseData {
  detail?: string
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ErrorResponseData>(error)) {
    return error.response?.data?.detail || fallback
  }
  return fallback
}
