import type { Meta, StoryObj } from '@storybook/react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
} from './Select'

const meta: Meta<typeof Select> = {
  title: 'v2/Select',
  component: Select,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Select>

export const Default: Story = {
  render: () => (
    <Select defaultValue="apple">
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="选择水果" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">苹果</SelectItem>
        <SelectItem value="banana">香蕉</SelectItem>
        <SelectItem value="orange">橙子</SelectItem>
        <SelectItem value="grape">葡萄</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const WithPlaceholder: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="请选择一个选项..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option1">选项一</SelectItem>
        <SelectItem value="option2">选项二</SelectItem>
        <SelectItem value="option3">选项三</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const WithGroups: Story = {
  render: () => (
    <Select defaultValue="apple">
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="选择分类" />
      </SelectTrigger>
      <SelectContent>
        <SelectLabel>水果</SelectLabel>
        <SelectItem value="apple">苹果</SelectItem>
        <SelectItem value="banana">香蕉</SelectItem>
        <SelectLabel>蔬菜</SelectLabel>
        <SelectItem value="carrot">胡萝卜</SelectItem>
        <SelectItem value="potato">土豆</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const Searchable: Story = {
  render: () => (
    <Select searchable defaultValue="">
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="搜索并选择..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="react">React</SelectItem>
        <SelectItem value="vue">Vue</SelectItem>
        <SelectItem value="angular">Angular</SelectItem>
        <SelectItem value="svelte">Svelte</SelectItem>
        <SelectItem value="solid">Solid.js</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const Disabled: Story = {
  render: () => (
    <Select defaultValue="apple">
      <SelectTrigger className="w-[200px]" disabled>
        <SelectValue placeholder="选择水果" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">苹果</SelectItem>
        <SelectItem value="banana" disabled>香蕉 (禁用)</SelectItem>
        <SelectItem value="orange">橙子</SelectItem>
      </SelectContent>
    </Select>
  ),
}
