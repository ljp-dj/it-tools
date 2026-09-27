export interface CanteenData {
  id: string;
  name: string;
  dishes: string[];
}

export interface DishChoice {
  canteenId: string;
  canteenName: string;
  dish: string;
}

/** 把用户在文本框里输入的内容（换行 / 中英文逗号 / 顿号 / 分号分隔）解析成菜品数组 */
export const parseDishes = (text: string): string[] =>
  text
    .split(/[\n,，、;；]+/)
    .map(item => item.trim())
    .filter(Boolean);

/** 从所有食堂中收集全部菜品，并附上所属食堂信息 */
export const collectDishes = (canteens: CanteenData[]): DishChoice[] =>
  canteens.flatMap(canteen =>
    canteen.dishes.map(dish => ({
      canteenId: canteen.id,
      canteenName: canteen.name,
      dish,
    })),
  );

/** 通用随机抽取；空数组返回 null。rand 可注入，便于测试 */
export const pickRandom = <T>(items: readonly T[], rand: () => number = Math.random): T | null => {
  if (items.length === 0) {
    return null;
  }
  return items[Math.floor(rand() * items.length)];
};

/** 过滤掉没有名称的食堂 */
export const validCanteens = (canteens: CanteenData[]): CanteenData[] =>
  canteens.filter(canteen => canteen.name.trim() !== '');
