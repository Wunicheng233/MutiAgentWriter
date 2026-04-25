import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from './Card';
import Badge from './Badge';
import { Input } from './Input';
import {
  listPerspectives,
  updateProjectPerspective,
  type Perspective,
  type UpdateProjectPerspectiveRequest,
} from '../utils/endpoints';
import { useToast } from './toastContext';

export interface PerspectiveSelectorProps {
  projectId: number;
  value: string | null;
  onChange?: (perspectiveId: string | null) => void;
  initialStrength?: number;
  initialUseForCritic?: boolean;
  compact?: boolean; // 紧凑模式（用于侧边栏）
}

const genreIcons: Record<string, string> = {
  '科幻': '🚀',
  '武侠': '⚔️',
  '奇幻': '✨',
  '文学': '📖',
  '网文': '💻',
};

export const PerspectiveSelector: React.FC<PerspectiveSelectorProps> = ({
  projectId,
  value,
  onChange,
  initialStrength = 0.7,
  initialUseForCritic = true,
  compact = false,
}) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [strength, setStrength] = useState(initialStrength);
  const [useForCritic, setUseForCritic] = useState(initialUseForCritic);

  // 获取视角列表
  const { data: perspectivesData, isLoading } = useQuery({
    queryKey: ['perspectives'],
    queryFn: listPerspectives,
    staleTime: 1000 * 60 * 60, // 缓存 1 小时
  });

  const perspectives = perspectivesData?.perspectives || [];

  // 更新项目视角配置
  const updateMutation = useMutation({
    mutationFn: (data: UpdateProjectPerspectiveRequest) =>
      updateProjectPerspective(projectId, data),
    onSuccess: () => {
      showToast('视角配置已更新', 'success');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: () => {
      showToast('更新失败，请重试', 'error');
    },
  });

  // 选择视角
  const handleSelect = (perspectiveId: string | null) => {
    updateMutation.mutate({
      perspective: perspectiveId,
      perspective_strength: strength,
      use_perspective_critic: useForCritic,
    });
    onChange?.(perspectiveId);
  };

  // 强度变化时自动保存
  const handleStrengthChange = (newStrength: number) => {
    setStrength(newStrength);
    if (value) {
      updateMutation.mutate({
        perspective: value,
        perspective_strength: newStrength,
        use_perspective_critic: useForCritic,
      });
    }
  };

  // Critic 开关变化时自动保存
  const handleUseForCriticChange = (checked: boolean) => {
    setUseForCritic(checked);
    if (value) {
      updateMutation.mutate({
        perspective: value,
        perspective_strength: strength,
        use_perspective_critic: checked,
      });
    }
  };

  // 按题材分组并过滤搜索
  const filteredPerspectives = perspectives.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.genre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedPerspectives = filteredPerspectives.reduce((acc, p) => {
    if (!acc[p.genre]) {
      acc[p.genre] = [];
    }
    acc[p.genre].push(p);
    return acc;
  }, {} as Record<string, Perspective[]>);

  if (isLoading) {
    return (
      <div className="p-4 text-[var(--text-secondary)] text-center">
        正在加载视角列表...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <Input
          placeholder="搜索作家风格..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      )}

      <div className="space-y-6">
        {Object.entries(groupedPerspectives).map(([genre, items]) => (
          <div key={genre}>
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
              <span>{genreIcons[genre] || '📝'}</span>
              <span>{genre}</span>
              <span className="text-xs">({items.length})</span>
            </p>
            <div className="space-y-2">
              {items.map((p) => (
                <label
                  key={p.id}
                  className={`
                    block p-4 rounded-lg border cursor-pointer transition-all
                    ${value === p.id
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] bg-opacity-10 shadow-[var(--shadow-subtle)]'
                      : 'border-[var(--border-default)] hover:border-[var(--accent-primary)] border-opacity-40 hover:bg-[var(--bg-secondary)] bg-opacity-50'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="perspective"
                      value={p.id}
                      checked={value === p.id}
                      onChange={() => handleSelect(p.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">{p.description}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.strengths.slice(0, 3).map((s) => (
                          <Badge key={s} variant="secondary">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 不使用特定风格选项 */}
      <label className="block p-4 rounded-lg border border-[var(--border-default)] cursor-pointer hover:bg-[var(--bg-secondary)] bg-opacity-50 transition-all">
        <div className="flex items-center gap-3">
          <input
            type="radio"
            name="perspective"
            checked={value === null}
            onChange={() => handleSelect(null)}
          />
          <span>默认创作模式（无特定风格）</span>
        </div>
      </label>

      {/* 强度滑块和配置 */}
      {value && !compact && (
        <Card className="p-5 mt-6">
          <p className="font-medium mb-4">风格融入强度</p>
          <div className="space-y-4">
            <div>
              <input
                type="range"
                min="0"
                max="100"
                value={strength * 100}
                onChange={(e) => handleStrengthChange(Number(e.target.value) / 100)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-1">
                <span>轻微影响</span>
                <span>平衡</span>
                <span>强烈风格</span>
              </div>
              <p className="text-center text-sm mt-2 text-[var(--text-secondary)]">
                当前强度: {Math.round(strength * 100)}%
                {strength <= 0.3 && '（仅影响句式和词汇）'}
                {strength > 0.3 && strength <= 0.7 && '（完整融入心智模型）'}
                {strength > 0.7 && '（完全遵循该作家风格）'}
              </p>
            </div>

            <div className="pt-2 border-t border-[var(--border-default)]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useForCritic}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleUseForCriticChange(e.target.checked)
                  }
                />
                <span className="text-sm">
                  同时使用该作家的审美标准来评审质量
                </span>
              </label>
              <p className="text-xs text-[var(--text-secondary)] mt-1 ml-6">
                启用后，Critic 会按照该作家的创作标准来评估章节质量
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PerspectiveSelector;
