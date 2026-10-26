import React from 'react';
import { Button, Upload, message } from 'antd';
export function FinanceFile({ value, onChange }) {
  return <div><Upload accept="image/png,image/jpeg,application/pdf" showUploadList={false} beforeUpload={file => {
    if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) { message.error('请选择 PNG、JPG 或 PDF'); return false; }
    if (file.size > 2 * 1024 * 1024) { message.error('本地预览文件请控制在 2MB 内'); return false; }
    const reader = new FileReader(); reader.onload = () => onChange?.({ name: file.name, url: reader.result }); reader.onerror = () => message.error('文件读取失败，请重试'); reader.readAsDataURL(file); return false;
  }}><Button>上传发票文件</Button></Upload>{value?.name && <div style={{ marginTop: 8 }}>{value.name} <FilePreview name={value.name} url={value.url} /></div>}</div>;
}
export function FilePreview({ name, url }) {
  if (!url || !/^(https?:\/\/|data:(image\/(png|jpeg)|application\/pdf);base64,)/.test(url)) return <span style={{ color: 'var(--erp-text-secondary)' }}>（来源文件待接入）</span>;
  return <a href={url} target="_blank" rel="noreferrer" download={url.startsWith('data:application/pdf') ? name : undefined}>{url.startsWith('data:application/pdf') ? '打开文件' : '预览'}</a>;
}
