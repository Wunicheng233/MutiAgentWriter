import type { Meta, StoryObj } from '@storybook/react'
import { Button } from '../Button/Button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './DropdownMenu'

const meta: Meta<typeof DropdownMenu> = {
  title: 'v2/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DropdownMenu>

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="secondary">打开菜单</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => console.log('Edit')}>编辑</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => console.log('Duplicate')}>复制</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => console.log('Delete')}>删除</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

export const WithLabel: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="secondary">操作选项</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>基础操作</DropdownMenuLabel>
        <DropdownMenuItem>新建项目</DropdownMenuItem>
        <DropdownMenuItem>打开项目</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>高级操作</DropdownMenuLabel>
        <DropdownMenuItem>导出数据</DropdownMenuItem>
        <DropdownMenuItem disabled>删除项目 (已禁用)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

export const AlignEnd: Story = {
  render: () => (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="secondary">右对齐菜单</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>选项一</DropdownMenuItem>
          <DropdownMenuItem>选项二</DropdownMenuItem>
          <DropdownMenuItem>选项三</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
}
