import React from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import locale from 'antd/es/date-picker/locale/zh_CN';

// Form values remain business-date strings, including Beijing wall time.
export default function HrDateField({ value, onChange, time = false, ...props }) {
  return <DatePicker {...props} locale={locale} style={{ width: '100%' }} value={value && dayjs(value).isValid() ? dayjs(value) : null}
    format={time ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'} showTime={time ? { format: 'HH:mm:ss' } : false}
    placeholder={time ? '选择北京时间' : '选择日期'} onChange={date => onChange?.(date ? date.format(time ? 'YYYY-MM-DDTHH:mm:ss' : 'YYYY-MM-DD') : '')} />;
}
