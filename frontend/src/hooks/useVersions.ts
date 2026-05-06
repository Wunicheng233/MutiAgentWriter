import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listChapterVersions,
  getChapterVersion,
  restoreChapterVersion,
} from '../utils/endpoints'
import { useToast } from '../components/toastContext'

export function useVersions(projectId: number, chapterIndex: number) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  // Query version list
  const {
    data: versionsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['versions', projectId, chapterIndex],
    queryFn: () => listChapterVersions(projectId, chapterIndex),
    enabled: !!projectId && !!chapterIndex && projectId > 0 && chapterIndex > 0,
  })

  const versions = versionsData?.versions ?? []

  // Get single version detail
  const getVersionDetail = (versionId: number) => {
    return getChapterVersion(projectId, chapterIndex, versionId)
  }

  // Restore version mutation
  const restoreMutation = useMutation({
    mutationFn: (versionId: number) =>
      restoreChapterVersion(projectId, chapterIndex, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['chapter', projectId, chapterIndex],
      })
      queryClient.invalidateQueries({
        queryKey: ['versions', projectId, chapterIndex],
      })
      showToast('已恢复到所选版本', 'success')
    },
    onError: (error: Error) => {
      showToast(error.message || '恢复失败', 'error')
    },
  })

  return {
    versions,
    isLoading,
    error,
    refetch,
    getVersionDetail,
    restoreVersion: restoreMutation.mutate,
    isRestoring: restoreMutation.isPending,
  }
}
