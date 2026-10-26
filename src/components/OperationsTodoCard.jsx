import React from 'react';
import { Alert, Button, Card, Empty, Table, Tag } from 'antd';
import { attentionReasons, operationsTodos } from '../data/operationsDashboard';
import { useOperationsPreview } from '../hooks/useOperationsPreview';
import { scopeManagerTodos } from '../data/todoScope';

export function OperationsTodoCard({ role, onNavigate, manager = 'all' }) {
  const { state, error, reload } = useOperationsPreview();
  const rows = state ? scopeManagerTodos(operationsTodos(state, role), role, manager) : [];
  if (role === '财务') return null;
  return <Card variant="borderless" className="todo-work-card operations-todo-card">
    <div className="todo-card-heading"><div><h2>经营周报待核对</h2><p>{role === 'PM' ? '仅本人负责项目' : manager === 'all' ? '全部授权项目' : `${manager}负责项目`}，含历史未处理事项。与工作台待核对事项同步，问题解决后自动移除。</p></div><Tag color={rows.length ? 'warning' : 'default'}>{rows.length} 条待核对</Tag></div>
    {error && <Alert type="error" showIcon title="经营待办读取失败" description={error} action={<Button onClick={reload}>重试</Button>} />}
    <Table rowKey="key" loading={!state && !error} dataSource={rows} scroll={{ x: 820 }} pagination={{ defaultPageSize: 8, showSizeChanger: true, showTotal: total => `共 ${total} 条待核对` }}
      columns={[
        { title: '项目名称', dataIndex: 'name', width: 210 },
        { title: '负责PM', dataIndex: 'pm', width: 90 },
        { title: '业务周', width: 195, render: (_, row) => `${row.start} 至 ${row.end}` },
        { title: '待核对原因', render: (_, row) => attentionReasons(row).join('；') },
        { title: '操作', width: 105, fixed: 'right', render: (_, row) => <Button type="link" onClick={() => onNavigate(`overview:${row.key}`)}>查看处理</Button> },
      ]} locale={{ emptyText: <Empty description={error ? '暂时无法读取待核对事项' : '当前没有经营周报待核对事项'} /> }} />
  </Card>;
}
