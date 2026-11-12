import React from 'react';
import { Button, Empty, Space, Switch, Table, Tag } from 'antd';

export function PmAvailableList({ manager, rows, busy, onRow, renderGrip, onVisibility, selection, canExtract, onClaim, onInspect }) {
  return <>
    <div className="hr-card-heading"><div><h2>{manager.name}的可分配人员</h2><p>共 {rows.length} 人 · {rows.some(r => r.canManage) ? '拖动姓名左侧的手柄到本人项目即可分配；隐藏人员也可拖动。' : '公开的全职人员可提取到自己的名单或项目。'}</p></div></div>
    <Table className="transfer-table" size="small" rowKey="personId" rowSelection={selection} dataSource={rows} onRow={onRow} scroll={{ x: 650 }}
      pagination={{ pageSize: 10, hideOnSinglePage: true }} locale={{ emptyText: <Empty description="暂无可查看的全职人员" /> }} columns={[
        { title: '全职人员', width: 150, render: (_, r) => <div className="transfer-person-cell">{renderGrip(r)}<div><Button type="link" className="hr-name-link" onClick={() => onInspect(r.personId)}>{r.name}</Button><small className="hr-cell-note">{r.employeeNo}</small></div></div> },
        { title: '释放来源项目', width: 180, render: (_, r) => r.sourceProjectNames.join('、') },
        { title: '共享状态', width: 155, render: (_, r) => r.canManage ? <Space><Switch size="small" checked={r.visible} disabled={busy} aria-label={r.name + '对其他PM可见'} onChange={visible => onVisibility(r, visible)} />{r.visible ? '显示' : '隐藏'}</Space> : <Tag>显示</Tag> },
        { title: '操作', width: 150, render: (_, r) => <Space size={0}><Button type="link" onClick={() => onInspect(r.personId)}>详情</Button>{(r.canManage || r.canClaimAvailable) && <Button type="link" disabled={busy || !canExtract(r)} onClick={() => onClaim(r)}>提取</Button>}</Space> },
      ]} />
  </>;
}
