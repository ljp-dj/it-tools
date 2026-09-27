import { describe, expect, it } from 'vitest';
import { EXAMPLE_DOCUMENT, checkDocument } from './official-document-checker.service';

const GOOD_DOCUMENT = `关于开展2026年秋季社团招新工作的通知
各学生社团：
　　为丰富校园文化生活，现将2026年秋季招新工作安排如下。
　　一、招新时间
　　（一）报名阶段
　　1.线上报名
　　（1）请如实填写报名信息。
　　二、其他事项
　　请各社团按时提交报名材料。
学生社团联合会
2026年9月27日`;

describe('official-document-checker', () => {
  it('空白文本返回 error 级提示', () => {
    const issues = checkDocument('   \n \n  ');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
  });

  it('规范公文不报告任何问题', () => {
    expect(checkDocument(GOOD_DOCUMENT)).toHaveLength(0);
  });

  it('示例问题公文能检出各类典型错误', () => {
    const issues = checkDocument(EXAMPLE_DOCUMENT);
    const has = (category: string, keyword: string, severity: string) =>
      issues.some(
        issue => issue.category === category && issue.severity === severity && issue.message.includes(keyword),
      );

    expect(has('标题', '文种', 'error')).toBe(true);
    expect(has('主送机关', '半角冒号', 'error')).toBe(true);
    expect(has('标点符号', '句号', 'error')).toBe(true);
    expect(has('成文日期', '点号', 'error')).toBe(true);
    expect(has('层次序号', '跳级', 'warning')).toBe(true);
    expect(has('用词规范', '做为', 'warning')).toBe(true);
    expect(has('用词规范', '其它', 'warning')).toBe(true);
    expect(has('标点符号', '半角', 'warning')).toBe(true);
    expect(has('用词规范', '模糊', 'info')).toBe(true);
  });
});
