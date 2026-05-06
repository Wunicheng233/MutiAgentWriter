import React, { useState } from 'react'
import { Button } from '../components/v2/Button'
import { Card } from '../components/v2/Card'
import { Input } from '../components/v2/Input'
import { Textarea } from '../components/v2/Input'
import { Badge } from '../components/v2/Badge'

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4 mt-8 first:mt-0">
    {children}
  </h2>
)

const SubsectionTitle = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`text-sm font-medium text-[var(--text-secondary)] mb-3 mt-6 uppercase tracking-wider ${className}`.trim()}>
    {children}
  </h3>
)

const DemoRow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-4 mb-4">
    {children}
  </div>
)

export default function ComponentShowcase() {
  const [inputValue, setInputValue] = useState('')
  const [textareaValue, setTextareaValue] = useState('')

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            v2 组件库展示
          </h1>
          <p className="text-[var(--text-secondary)]">
            StoryForge AI 新版设计系统组件完整展示
          </p>
        </div>

        <Card padding="lg" className="mb-6">
          <SectionTitle>Badge 徽章</SectionTitle>

          <SubsectionTitle>所有变体</SubsectionTitle>
          <DemoRow>
            <Badge variant="primary">Primary</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
          </DemoRow>

          <SubsectionTitle>实际应用场景</SubsectionTitle>
          <DemoRow>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-secondary)]">项目状态:</span>
              <Badge variant="success">已完成</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-secondary)]">生成中:</span>
              <Badge variant="warning">进行中</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-secondary)]">错误:</span>
              <Badge variant="error">失败</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-secondary)]">新功能:</span>
              <Badge variant="primary">NEW</Badge>
            </div>
          </DemoRow>
        </Card>

        <Card padding="lg" className="mb-6">
          <SectionTitle>Button 按钮</SectionTitle>

          <SubsectionTitle>变体 Variants</SubsectionTitle>
          <DemoRow>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="tertiary">Tertiary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </DemoRow>

          <SubsectionTitle>尺寸 Sizes</SubsectionTitle>
          <DemoRow>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </DemoRow>

          <SubsectionTitle>状态 States</SubsectionTitle>
          <DemoRow>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </DemoRow>

          <SubsectionTitle>带图标 With Icons</SubsectionTitle>
          <DemoRow>
            <Button leftIcon={<span className="text-sm font-mono">&larr;</span>}>返回</Button>
            <Button rightIcon={<span className="text-sm font-mono">&rarr;</span>}>下一步</Button>
            <Button variant="secondary" leftIcon={<span className="font-mono">+</span>}>添加项目</Button>
          </DemoRow>

          <SubsectionTitle>全宽 Full Width</SubsectionTitle>
          <div className="w-full max-w-md">
            <Button fullWidth>提交表单</Button>
          </div>
        </Card>

        <Card padding="lg" className="mb-6">
          <SectionTitle>Input 输入框</SectionTitle>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <SubsectionTitle>基础样式</SubsectionTitle>
              <Input
                label="邮箱地址"
                placeholder="your@email.com"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="mb-4"
              />
              <Input
                label="搜索"
                placeholder="输入关键词搜索..."
                leftElement={<span className="text-[var(--text-muted)] font-mono">⌘K</span>}
                className="mb-4"
              />
              <Input
                label="个人主页"
                placeholder="username"
                leftElement="https://"
                rightElement=".com"
              />
            </div>

            <div>
              <SubsectionTitle>尺寸 Sizes</SubsectionTitle>
              <Input
                label="Small"
                inputSize="sm"
                placeholder="小尺寸输入框"
                className="mb-4"
              />
              <Input
                label="Medium (默认)"
                inputSize="md"
                placeholder="中尺寸输入框"
                className="mb-4"
              />
              <Input
                label="Large"
                inputSize="lg"
                placeholder="大尺寸输入框"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <SubsectionTitle>状态 States</SubsectionTitle>
              <Input
                label="默认状态"
                placeholder="正常输入"
                className="mb-4"
              />
              <Input
                label="错误状态"
                status="error"
                errorMessage="请输入有效的邮箱地址"
                placeholder="invalid-email"
                className="mb-4"
              />
              <Input
                label="成功状态"
                status="success"
                placeholder="验证通过"
              />
            </div>

            <div>
              <SubsectionTitle>禁用与全宽</SubsectionTitle>
              <Input
                label="禁用状态"
                disabled
                placeholder="无法编辑"
                className="mb-4"
              />
              <Input
                label="全宽样式"
                fullWidth
                placeholder="占据父容器全部宽度"
              />
            </div>
          </div>

          <SubsectionTitle className="mt-8">Textarea 多行文本</SubsectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Textarea
              label="项目描述"
              placeholder="请输入项目的详细描述..."
              rows={4}
              value={textareaValue}
              onChange={(e) => setTextareaValue(e.target.value)}
            />
            <Textarea
              label="带错误信息"
              placeholder="这是必填字段..."
              rows={4}
              errorMessage="描述内容不能为空"
            />
          </div>
        </Card>

        <SectionTitle>Card 卡片</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card variant="default" padding="md" hoverable>
            <h3 className="font-semibold text-[var(--text-primary)] mb-2">Default 卡片</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              默认样式，带有微妙的背景色和悬停效果。
            </p>
          </Card>

          <Card variant="outlined" padding="md" hoverable>
            <h3 className="font-semibold text-[var(--text-primary)] mb-2">Outlined 卡片</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              边框样式，透明背景，适合需要区分层级的场景。
            </p>
          </Card>

          <Card variant="elevated" padding="md" hoverable>
            <h3 className="font-semibold text-[var(--text-primary)] mb-2">Elevated 卡片</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              带有阴影效果，适合需要突出显示的内容。
            </p>
          </Card>
        </div>

        <SubsectionTitle>内边距 Padding</SubsectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card variant="outlined" padding="none">
            <div className="p-4 bg-[var(--bg-secondary)]">
              <code className="text-xs">padding="none"</code>
            </div>
          </Card>
          <Card variant="outlined" padding="sm">
            <code className="text-xs">padding="sm"</code>
          </Card>
          <Card variant="outlined" padding="md">
            <code className="text-xs">padding="md"</code>
          </Card>
          <Card variant="outlined" padding="lg">
            <code className="text-xs">padding="lg"</code>
          </Card>
        </div>

        <SubsectionTitle>实际应用示例</SubsectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card variant="elevated" padding="lg" hoverable>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">《黎明破晓》</h3>
                <p className="text-sm text-[var(--text-secondary)]">奇幻 · 长篇小说</p>
              </div>
              <Badge variant="success">进行中</Badge>
            </div>
            <p className="text-sm text-[var(--text-body)] mb-4">
              在一个被永恒黎明笼罩的世界里，年轻的探险家踏上了寻找真相的旅程...
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">第 12 章 / 共 50 章</span>
              <Button size="sm" variant="secondary">继续写作</Button>
            </div>
          </Card>

          <Card variant="elevated" padding="lg" hoverable>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">智能大纲生成</h3>
                <p className="text-sm text-[var(--text-secondary)]">Workflow</p>
              </div>
              <Badge variant="warning">运行中</Badge>
            </div>
            <p className="text-sm text-[var(--text-body)] mb-4">
              AI 正在分析您的剧情设定，自动生成完整的章节大纲结构...
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">预计剩余: 45秒</span>
              <Button size="sm" variant="ghost" disabled>进行中...</Button>
            </div>
          </Card>
        </div>

        <Card padding="lg" className="text-center">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            v2 组件库第一阶段完成
          </h3>
          <p className="text-[var(--text-secondary)] mb-4">
            已完成 4 个核心组件，31 个单元测试，设计令牌系统已就绪
          </p>
          <div className="flex items-center justify-center gap-3">
            <Badge variant="success">Button 完成</Badge>
            <Badge variant="success">Card 完成</Badge>
            <Badge variant="success">Input 完成</Badge>
            <Badge variant="success">Badge 完成</Badge>
          </div>
        </Card>
      </div>
    </div>
  )
}
