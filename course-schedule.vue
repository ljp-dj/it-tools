<template>
  <div style="flex: 0 0 100%">
    <div style="margin: 0 auto; max-width: 1080px">
      <c-card class="mb-3">
        <div class="mb-2 text-lg font-bold">课表助手：冲突检测 · 空闲时段 · 个人计划</div>
        <p class="m-0 text-sm op-60">
          录入每周固定课程，工具会自动检测时间冲突、计算每天的空闲时段；点击空闲时段即可快速插入个人计划。数据只保存在本机浏览器中，断网也能使用。
        </p>
      </c-card>

      <c-card class="mb-3">
        <div class="mb-3 font-bold">添加课程 / 计划</div>
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex flex-col gap-1">
            <span class="text-xs op-60">名称</span>
            <input v-model="form.title" placeholder="如 高等数学" class="sch-input" style="min-width: 150px" data-test-id="evt-title" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs op-60">星期</span>
            <select v-model.number="form.day" class="sch-input" style="min-width: 90px">
              <option v-for="(d, i) in days" :key="i" :value="i">{{ d }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs op-60">开始</span>
            <input v-model="form.start" type="time" class="sch-input" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs op-60">结束</span>
            <input v-model="form.end" type="time" class="sch-input" />
          </div>
          <n-button type="primary" data-test-id="add-course" @click="addEvent('course')">添加课程</n-button>
          <n-button data-test-id="add-plan" @click="addEvent('plan')">添加个人计划</n-button>
        </div>
        <p v-if="formError" class="m-0 mt-2 text-sm" style="color: #d03050">{{ formError }}</p>
        <p v-if="formHint" class="m-0 mt-2 text-sm" style="color: #18a058">{{ formHint }}</p>
      </c-card>

      <c-card class="mb-3">
        <div class="mb-3 font-bold">一周时间轴（蓝色＝课程，绿色＝计划，红框＝冲突）</div>
        <div class="sch-grid">
          <div class="sch-axis">
            <div v-for="h in 14" :key="h" class="sch-tick" :style="{ top: (h - 1) * 44 + 'px' }">
              {{ toHM(DAY_START + (h - 1) * 60) }}
            </div>
          </div>
          <div v-for="(d, i) in days" :key="i" class="sch-col">
            <div class="sch-col-head">{{ d }}</div>
            <div class="sch-col-body">
              <div v-for="h in 13" :key="h" class="sch-line" :style="{ top: (h - 1) * 44 + 'px' }" />
              <div
                v-for="evt in eventsByDay[i]"
                :key="evt.id"
                class="sch-evt"
                :class="conflictIds.has(evt.id)
                  ? 'sch-evt-conflict'
                  : (evt.type === 'course' ? 'sch-evt-course' : 'sch-evt-plan')"
                :style="evtStyle(evt)"
              >
                <div class="sch-evt-title">{{ evt.title }}</div>
                <div class="sch-evt-time">{{ evt.start }}–{{ evt.end }}</div>
              </div>
            </div>
          </div>
        </div>
      </c-card>

      <c-card class="mb-3">
        <div class="mb-2 font-bold">本周空闲时段（点一下即可安排计划，只显示 30 分钟以上的空档）</div>
        <div v-for="(d, i) in days" :key="i" class="mb-2">
          <span class="inline-block w-12 op-70">{{ d }}</span>
          <template v-if="freeByDay[i].length">
            <n-button
              v-for="(slot, k) in freeByDay[i]"
              :key="k"
              size="small"
              secondary
              class="mr-2 mb-2"
              @click="useFreeSlot(i, slot[0], slot[1])"
            >
              ＋ {{ toHM(slot[0]) }}–{{ toHM(slot[1]) }}
            </n-button>
          </template>
          <span v-else class="text-sm op-50">无 30 分钟以上空闲</span>
        </div>
      </c-card>

      <c-card class="mb-3">
        <div class="mb-2 flex items-center justify-between">
          <span class="font-bold">课程与计划明细</span>
          <n-button size="small" type="error" ghost :disabled="!events.length" @click="events = []">清空全部</n-button>
        </div>
        <div v-for="(d, i) in days" :key="i" class="mb-3">
          <div class="mb-1 font-bold">{{ d }}</div>
          <div v-if="!eventsByDay[i].length" class="ml-2 text-sm op-50">—</div>
          <div
            v-for="evt in eventsByDay[i]"
            :key="evt.id"
            class="sch-row"
            :class="conflictIds.has(evt.id)
              ? 'sch-row-conflict'
              : (evt.type === 'course' ? 'sch-row-course' : 'sch-row-plan')"
          >
            <span class="sch-tag">{{ evt.type === 'course' ? '课程' : '计划' }}</span>
            <span class="font-medium">{{ evt.title }}</span>
            <span class="op-70">{{ evt.start }} – {{ evt.end }}</span>
            <span v-if="conflictIds.has(evt.id)" class="sch-warn">时间冲突！</span>
            <n-button size="tiny" quaternary type="error" @click="removeEvent(evt.id)">删除</n-button>
          </div>
        </div>
      </c-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

type EventType = 'course' | 'plan';

type ScheduleEvent = {
  id: string;
  title: string;
  day: number;
  start: string;
  end: string;
  type: EventType;
};

const STORAGE_KEY = 'campus-course-schedule-v1';
const DAY_START = 8 * 60; // 每天统计范围 08:00
const DAY_END = 22 * 60; // 22:00
const MIN_FREE_MINUTES = 30;

const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const toMin = (hm: string) => {
  if (!hm) {
    return 0;
  }
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};

const toHM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const events = ref<ScheduleEvent[]>([]);

const form = ref({ title: '', day: 0, start: '08:00', end: '09:40' });
const formError = ref('');
const formHint = ref('');

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      events.value = JSON.parse(raw);
    }
  } catch {
    // 本地数据损坏时保持空课表，不影响使用
  }
});

watch(events, value => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true });

const eventsByDay = computed(() =>
  days.map((_, i) =>
    events.value
      .filter(e => e.day === i)
      .sort((a, b) => toMin(a.start) - toMin(b.start)),
  ),
);

const conflictIds = computed(() => {
  const set = new Set<string>();
  const list = events.value;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (a.day !== b.day) {
        continue;
      }
      if (toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end)) {
        set.add(a.id);
        set.add(b.id);
      }
    }
  }
  return set;
});

const freeByDay = computed(() =>
  days.map((_, day) => {
    const occupied = events.value
      .filter(e => e.day === day)
      .map(e => [Math.max(toMin(e.start), DAY_START), Math.min(toMin(e.end), DAY_END)])
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);

    let cursor = DAY_START;
    const free: number[][] = [];
    occupied.forEach(([s, e]) => {
      if (s > cursor) {
        free.push([cursor, s]);
      }
      if (e > cursor) {
        cursor = e;
      }
    });
    if (cursor < DAY_END) {
      free.push([cursor, DAY_END]);
    }
    return free.filter(([s, e]) => e - s >= MIN_FREE_MINUTES);
  }),
);

const addEvent = (type: EventType) => {
  formHint.value = '';
  const start = toMin(form.value.start);
  const end = toMin(form.value.end);
  if (!form.value.start || !form.value.end) {
    formError.value = '请选择开始和结束时间';
    return;
  }
  if (end <= start) {
    formError.value = '结束时间必须晚于开始时间';
    return;
  }
  if (start < DAY_START || end > DAY_END) {
    formError.value = '时间请安排在 08:00–22:00 之间';
    return;
  }
  events.value.push({
    id: uid(),
    title: form.value.title.trim() || (type === 'course' ? '未命名课程' : '个人计划'),
    day: form.value.day,
    start: form.value.start,
    end: form.value.end,
    type,
  });
  formError.value = '';
  form.value.title = '';
};

const useFreeSlot = (day: number, start: number, end: number) => {
  form.value.day = day;
  form.value.start = toHM(start);
  form.value.end = toHM(end);
  formError.value = '';
  formHint.value = `已填入${days[day]} ${toHM(start)}–${toHM(end)}，写好计划名称后点「添加个人计划」即可`;
};

const removeEvent = (id: string) => {
  events.value = events.value.filter(e => e.id !== id);
};

const evtStyle = (evt: ScheduleEvent) => ({
  top: `${((toMin(evt.start) - DAY_START) / 60) * 44}px`,
  height: `${((toMin(evt.end) - toMin(evt.start)) / 60) * 44}px`,
});
</script>

<style lang="less" scoped>
.sch-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--n-border-color, #d9d9d9);
  border-radius: 6px;
  background: var(--n-color, #fff);
  font-size: 14px;
}

.sch-grid {
  display: flex;
  border: 1px solid var(--n-border-color, #e5e5e5);
  border-radius: 6px;
  overflow: hidden;
}

.sch-axis {
  position: relative;
  flex: none;
  width: 46px;
  height: 616px;
  border-right: 1px dashed #e0e0e0;
}

.sch-tick {
  position: absolute;
  left: 0;
  width: 44px;
  padding-right: 4px;
  font-size: 10px;
  color: #999;
  text-align: right;
  transform: translateY(-50%);
}

.sch-col {
  flex: 1;
  min-width: 78px;
  border-right: 1px dashed #eee;

  &:last-child {
    border-right: none;
  }
}

.sch-col-head {
  padding: 6px 0;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  background: #fafafa;
  border-bottom: 1px solid #eee;
}

.sch-col-body {
  position: relative;
  height: 616px;
}

.sch-line {
  position: absolute;
  right: 0;
  left: 0;
  border-top: 1px dashed #f0f0f0;
}

.sch-evt {
  position: absolute;
  right: 2px;
  left: 2px;
  padding: 2px 4px;
  overflow: hidden;
  font-size: 11px;
  border-radius: 4px;
}

.sch-evt-title {
  overflow: hidden;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sch-evt-time {
  opacity: 0.85;
}

.sch-evt-course {
  color: #1268c6;
  background: #e8f3ff;
  border: 1px solid #a8d3ff;
}

.sch-evt-plan {
  color: #157a3d;
  background: #e9f9ef;
  border: 1px solid #a6e2c0;
}

.sch-evt-conflict {
  color: #c43232;
  background: #ffecec;
  border: 1px solid #ff9c9c;
}

.sch-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  margin: 4px 0 4px 8px;
  font-size: 14px;
  border: 1px solid transparent;
  border-radius: 6px;
}

.sch-row-course {
  background: #f0f7ff;
  border-color: #cfe5ff;
}

.sch-row-plan {
  background: #f0fbf4;
  border-color: #cdeedd;
}

.sch-row-conflict {
  background: #fff1f1;
  border-color: #ffc4c4;
}

.sch-tag {
  padding: 1px 8px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 10px;
}

.sch-warn {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: #d03050;
}
</style>
