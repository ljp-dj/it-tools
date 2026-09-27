import { describe, expect, it } from 'vitest';
import { collectDishes, parseDishes, pickRandom, validCanteens, type CanteenData } from './canteen-picker.service';

const canteens: CanteenData[] = [
  { id: 'c1', name: '一食堂', dishes: ['红烧肉', '番茄炒蛋'] },
  { id: 'c2', name: '二食堂', dishes: ['麻辣香锅'] },
  { id: 'c3', name: '   ', dishes: ['无名菜'] },
];

describe('canteen-picker', () => {
  it('解析菜品：支持换行、中英文逗号、顿号、分号混用并去空白', () => {
    expect(parseDishes('红烧肉\n番茄炒蛋，麻婆豆腐、可乐鸡翅；鱼香肉丝, 蛋炒饭')).toEqual([
      '红烧肉',
      '番茄炒蛋',
      '麻婆豆腐',
      '可乐鸡翅',
      '鱼香肉丝',
      '蛋炒饭',
    ]);
    expect(parseDishes('  \n ， \n')).toEqual([]);
  });

  it('收集菜品时保留所属食堂信息', () => {
    const dishes = collectDishes(canteens.filter(c => c.name.trim()));
    expect(dishes).toHaveLength(3);
    expect(dishes[0]).toEqual({ canteenId: 'c1', canteenName: '一食堂', dish: '红烧肉' });
    expect(dishes[2]).toEqual({ canteenId: 'c2', canteenName: '二食堂', dish: '麻辣香锅' });
  });

  it('空数组随机抽取返回 null，非空时结果必在候选集合内', () => {
    expect(pickRandom([])).toBeNull();
    const pool = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i += 1) {
      expect(pool).toContain(pickRandom(pool) as string);
    }
  });

  it('注入固定随机数时抽取结果确定：rand=0 取首个，接近 1 取末尾', () => {
    const pool = ['a', 'b', 'c'];
    expect(pickRandom(pool, () => 0)).toBe('a');
    expect(pickRandom(pool, () => 0.999999)).toBe('c');
  });

  it('各候选长期来看都能被抽中（无死项）', () => {
    const pool = ['a', 'b', 'c', 'd'];
    const hit = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      hit.add(pickRandom(pool) as string);
    }
    expect([...hit].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('过滤无名食堂', () => {
    expect(validCanteens(canteens).map(c => c.name)).toEqual(['一食堂', '二食堂']);
  });
});
