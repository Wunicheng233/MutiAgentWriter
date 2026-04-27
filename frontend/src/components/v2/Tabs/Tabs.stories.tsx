import type { Meta, StoryObj } from '@storybook/react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs'

const meta: Meta<typeof Tabs> = {
  title: 'v2/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'pills', 'outline', 'transparent'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Tabs>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="tab1">标签一</TabsTrigger>
        <TabsTrigger value="tab2">标签二</TabsTrigger>
        <TabsTrigger value="tab3">标签三</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <p className="text-[var(--text-secondary)]">这是标签一的内容区域。</p>
      </TabsContent>
      <TabsContent value="tab2">
        <p className="text-[var(--text-secondary)]">这是标签二的内容区域。</p>
      </TabsContent>
      <TabsContent value="tab3">
        <p className="text-[var(--text-secondary)]">这是标签三的内容区域。</p>
      </TabsContent>
    </Tabs>
  ),
}

export const Pills: Story = {
  render: () => (
    <Tabs defaultValue="tab1" variant="pills" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="tab1">首页</TabsTrigger>
        <TabsTrigger value="tab2">文档</TabsTrigger>
        <TabsTrigger value="tab3">设置</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <p className="text-[var(--text-secondary)]">Pills 样式的标签页内容。</p>
      </TabsContent>
      <TabsContent value="tab2">
        <p className="text-[var(--text-secondary)]">文档内容区域。</p>
      </TabsContent>
      <TabsContent value="tab3">
        <p className="text-[var(--text-secondary)]">设置内容区域。</p>
      </TabsContent>
    </Tabs>
  ),
}

export const Outline: Story = {
  render: () => (
    <Tabs defaultValue="tab1" variant="outline" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="tab1">概览</TabsTrigger>
        <TabsTrigger value="tab2">详情</TabsTrigger>
        <TabsTrigger value="tab3">历史</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <p className="text-[var(--text-secondary)]">Outline 样式，带有底部边框指示。</p>
      </TabsContent>
      <TabsContent value="tab2">
        <p className="text-[var(--text-secondary)]">详情内容。</p>
      </TabsContent>
      <TabsContent value="tab3">
        <p className="text-[var(--text-secondary)]">历史记录。</p>
      </TabsContent>
    </Tabs>
  ),
}

export const Transparent: Story = {
  render: () => (
    <Tabs defaultValue="tab1" variant="transparent" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="tab1">全部</TabsTrigger>
        <TabsTrigger value="tab2">已发布</TabsTrigger>
        <TabsTrigger value="tab3">草稿</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <p className="text-[var(--text-secondary)]">透明样式的标签页。</p>
      </TabsContent>
      <TabsContent value="tab2">
        <p className="text-[var(--text-secondary)]">已发布的内容。</p>
      </TabsContent>
      <TabsContent value="tab3">
        <p className="text-[var(--text-secondary)]">草稿内容。</p>
      </TabsContent>
    </Tabs>
  ),
}

export const WithDisabled: Story = {
  render: () => (
    <Tabs defaultValue="tab1" variant="pills" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="tab1">可用</TabsTrigger>
        <TabsTrigger value="tab2" disabled>已禁用</TabsTrigger>
        <TabsTrigger value="tab3">可用</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <p className="text-[var(--text-secondary)]">第一个标签页内容。</p>
      </TabsContent>
      <TabsContent value="tab3">
        <p className="text-[var(--text-secondary)]">第三个标签页内容。</p>
      </TabsContent>
    </Tabs>
  ),
}
