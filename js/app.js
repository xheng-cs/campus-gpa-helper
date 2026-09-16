/**
 * GPA+ 校园学业助手 —— 界面层
 * 职责：DOM 渲染、事件交互、localStorage 持久化。
 * 计算逻辑全部在 js/gpa.js（window.GPA），界面与算法分离以便测试。
 */
(function () {
  'use strict';

  if (!window.GPA) {
    document.body.innerHTML =
      '<p style="padding:40px;text-align:center">资源加载失败：请确认 js/gpa.js 与 js/app.js 在同一目录下。</p>';
    return;
  }

  const { parseScore, scoreToPoint, computeStats } = window.GPA;

  /* ---------- 本地存储（带容错） ---------- */
  const KEYS = { courses: 'gpaplus.courses', todos: 'gpaplus.todos', mode: 'gpaplus.mode' };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (err) {
      console.warn('[GPA+] 读取本地数据失败，使用默认值：', err);
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn('[GPA+] 保存本地数据失败（浏览器隐私模式可能受限）：', err);
    }
  }

  function sanitizeCourses(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(
      (c) => c && typeof c.name === 'string' && Number.isFinite(c.credits) && c.credits > 0 && Number.isFinite(c.score)
    );
  }

  function sanitizeTodos(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((t) => t && typeof t.title === 'string' && typeof t.done === 'boolean');
  }

  const state = {
    courses: sanitizeCourses(load(KEYS.courses, [])),
    todos: sanitizeTodos(load(KEYS.todos, [])),
    mode: load(KEYS.mode, '4.0') === '5.0' ? '5.0' : '4.0',
  };

  /* ---------- 工具函数 ---------- */
  const $ = (sel) => document.querySelector(sel);

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function fmtNum(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }

  function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function dueBadge(due) {
    if (!due) return '';
    const today = todayStr();
    if (due < today) return '<span class="badge overdue">已过期</span>';
    if (due === today) return '<span class="badge today">今天截止</span>';
    return `<span class="badge upcoming">${escapeHtml(due)}</span>`;
  }

  /* ---------- 渲染 ---------- */
  function renderStats() {
    const { courseCount, totalCredits, weightedAverage, gpa } = computeStats(state.courses, state.mode);
    const cards = [
      { label: '课程数', value: String(courseCount) },
      { label: '总学分', value: fmtNum(totalCredits) },
      { label: '加权平均分', value: weightedAverage == null ? '—' : fmtNum(weightedAverage) },
      { label: `GPA（${state.mode}）`, value: gpa == null ? '—' : fmtNum(gpa) },
    ];
    $('#statsGrid').innerHTML = cards
      .map((c) => `<div class="stat-card"><div class="value">${escapeHtml(c.value)}</div><div class="label">${escapeHtml(c.label)}</div></div>`)
      .join('');
  }

  function renderCourses() {
    const tbody = $('#courseBody');
    $('#courseEmpty').classList.toggle('hidden', state.courses.length > 0);
    tbody.innerHTML = state.courses
      .map(
        (c, i) => `
        <tr>
          <td>${escapeHtml(c.name)}</td>
          <td>${fmtNum(c.credits)}</td>
          <td>${fmtNum(c.score)}</td>
          <td>${fmtNum(scoreToPoint(c.score, state.mode))}</td>
          <td><button class="del" data-del-course="${i}" title="删除该课程">✕</button></td>
        </tr>`
      )
      .join('');
  }

  function renderTodos() {
    const list = $('#todoList');
    const pending = state.todos.filter((t) => !t.done).length;
    $('#todoCount').textContent = String(pending);

    // 排序：未完成在前 → 截止日期近的在前 → 无截止日期放最后（保持添加顺序）
    const sorted = [...state.todos].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const da = a.due || '9999-99-99';
      const db = b.due || '9999-99-99';
      return da < db ? -1 : da > db ? 1 : 0;
    });

    $('#todoEmpty').classList.toggle('hidden', sorted.length > 0);
    list.innerHTML = sorted
      .map((t) => {
        const courseTag = t.course ? `<span class="todo-course">${escapeHtml(t.course)}</span>` : '';
        return `
        <li class="todo-item ${t.done ? 'done' : ''}">
          <input type="checkbox" class="todo-check" data-toggle-todo="${escapeHtml(t.id)}" ${t.done ? 'checked' : ''} />
          <span class="todo-title">${escapeHtml(t.title)}</span>
          ${courseTag}
          <span class="todo-meta">${dueBadge(t.due)}</span>
          <button class="del" data-del-todo="${escapeHtml(t.id)}" title="删除">✕</button>
        </li>`;
      })
      .join('');
  }

  function renderAll() {
    renderStats();
    renderCourses();
    renderTodos();
  }

  /* ---------- 事件处理 ---------- */
  function onAddCourse(e) {
    e.preventDefault();
    const name = $('#courseName').value.trim();
    const credits = Number($('#courseCredits').value);
    const score = parseScore($('#courseScore').value);

    if (!name || !Number.isFinite(credits) || credits <= 0) {
      alert('请填写课程名和大于 0 的学分');
      return;
    }
    if (score == null) {
      alert('无法识别成绩：支持数字（如 92、88.5、60）或等级（优秀/良好/中等/及格/不及格）');
      return;
    }

    state.courses.push({ name, credits, score });
    save(KEYS.courses, state.courses);
    e.target.reset();
    renderAll();
  }

  function onAddTodo(e) {
    e.preventDefault();
    const title = $('#todoTitle').value.trim();
    if (!title) return;

    state.todos.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      title,
      course: $('#todoCourse').value.trim(),
      due: $('#todoDue').value || null,
      done: false,
    });
    save(KEYS.todos, state.todos);
    e.target.reset();
    renderAll();
  }

  function onListClick(e) {
    // 1) 勾选 / 取消完成
    const toggle = e.target.closest('[data-toggle-todo]');
    if (toggle) {
      const todo = state.todos.find((t) => t.id === toggle.dataset.toggleTodo);
      if (todo) {
        todo.done = !todo.done;
        save(KEYS.todos, state.todos);
        renderAll();
      }
      return;
    }
    // 2) 删除课程
    const delCourse = e.target.closest('[data-del-course]');
    if (delCourse) {
      state.courses.splice(Number(delCourse.dataset.delCourse), 1);
      save(KEYS.courses, state.courses);
      renderAll();
      return;
    }
    // 3) 删除待办
    const delTodo = e.target.closest('[data-del-todo]');
    if (delTodo) {
      state.todos = state.todos.filter((t) => t.id !== delTodo.dataset.delTodo);
      save(KEYS.todos, state.todos);
      renderAll();
    }
  }

  function loadSample() {
    const existing = new Set(state.courses.map((c) => c.name));
    const extra = SAMPLE_COURSES.filter((c) => !existing.has(c.name));
    if (extra.length > 0) {
      state.courses = state.courses.concat(extra);
      save(KEYS.courses, state.courses);
    }
    if (state.todos.length === 0) {
      state.todos = sampleTodos();
      save(KEYS.todos, state.todos);
    }
    renderAll();
  }

  function exportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      mode: state.mode,
      courses: state.courses,
      todos: state.todos,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gpaplus-export.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function clearCourses() {
    if (state.courses.length === 0) return;
    if (confirm('确定要清空全部课程吗？')) {
      state.courses = [];
      save(KEYS.courses, state.courses);
      renderAll();
    }
  }

  function clearDoneTodos() {
    const before = state.todos.length;
    state.todos = state.todos.filter((t) => !t.done);
    if (state.todos.length !== before) {
      save(KEYS.todos, state.todos);
      renderAll();
    }
  }

  /* ---------- 示例数据 ---------- */
  const SAMPLE_COURSES = [
    { name: '高等数学', credits: 5, score: 92 },
    { name: '大学英语', credits: 3, score: 85 },
    { name: '程序设计基础', credits: 4, score: 78 },
    { name: '大学体育', credits: 1, score: 95 },
  ];

  function sampleTodos() {
    const shift = (days) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };
    return [
      { id: `sample-${Date.now()}-1`, title: '高数第三章习题', course: '高等数学', due: shift(-1), done: false },
      { id: `sample-${Date.now()}-2`, title: '实验报告一：循环与数组', course: '程序设计基础', due: shift(2), done: false },
      { id: `sample-${Date.now()}-3`, title: '背单词 Unit 5', course: '大学英语', due: shift(7), done: true },
    ];
  }

  /* ---------- 事件绑定 ---------- */
  $('#courseForm').addEventListener('submit', onAddCourse);
  $('#todoForm').addEventListener('submit', onAddTodo);
  $('#courseBody').addEventListener('click', onListClick);
  $('#todoList').addEventListener('click', onListClick);
  $('#modeSelect').addEventListener('change', (e) => {
    state.mode = e.target.value;
    save(KEYS.mode, state.mode);
    renderAll();
  });
  $('#sampleBtn').addEventListener('click', loadSample);
  $('#exportBtn').addEventListener('click', exportJson);
  $('#clearCoursesBtn').addEventListener('click', clearCourses);
  $('#clearTodosBtn').addEventListener('click', clearDoneTodos);

  /* ---------- 初始化 ---------- */
  $('#modeSelect').value = state.mode;
  renderAll();
})();
