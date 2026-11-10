import test from 'node:test';
import assert from 'node:assert/strict';
import { insertPersonnelSearchPaste, matchesPersonnelSearch, parsePersonnelSearch } from './personnelSearch.js';

test('多人名单支持空格中英文逗号顿号分号换行和Excel制表符', () => {
  assert.deepEqual(parsePersonnelSearch('张三 李四,王五，赵六、钱七;孙八；周九\r\n吴十\tMCE123'),
    ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', 'MCE123']);
});

test('重复姓名和不同大小写编号按首次出现去重', () => {
  assert.deepEqual(parsePersonnelSearch('张三，张三 MCE123 mce123 李四'), ['张三', 'MCE123', '李四']);
});

test('空值和纯分隔符恢复无关键词浏览', () => {
  for (const value of ['', null, undefined, ' ，,、；;\r\n\t ']) {
    assert.deepEqual(parsePersonnelSearch(value), []);
    assert.equal(matchesPersonnelSearch('任意人员 MCE123', parsePersonnelSearch(value)), true);
  }
});

test('名单按任一姓名或编号匹配，编号不区分大小写', () => {
  const keywords = parsePersonnelSearch('张三，mce002');
  const people = ['张三 MCE001', '李四 MCE002', '王五 MCE003'];
  assert.deepEqual(people.filter(value => matchesPersonnelSearch(value, keywords)), ['张三 MCE001', '李四 MCE002']);
});

test('单个部分关键词沿用包含匹配且不匹配无关人员', () => {
  assert.equal(matchesPersonnelSearch('王小明 MCE000023', parsePersonnelSearch('小明')), true);
  assert.equal(matchesPersonnelSearch('李四 MCE000024', parsePersonnelSearch('小明')), false);
});

test('单行输入粘贴名单保留换行及制表符边界并替换选区', () => {
  const result = insertPersonnelSearchPaste('甲乙丙丁', '张三\r\n李四\tMCE123', 1, 3);
  assert.equal(result.value, '甲张三、李四、MCE123丁');
  assert.equal(result.caret, '甲张三、李四、MCE123'.length);
  assert.deepEqual(parsePersonnelSearch(insertPersonnelSearchPaste('', '张三\n李四\tMCE123', 0, 0).value), ['张三', '李四', 'MCE123']);
});

test('未提供选区时在输入末尾插入', () => {
  assert.deepEqual(insertPersonnelSearchPaste('张三、', '李四\n王五'), { value: '张三、李四、王五', caret: 8 });
});
