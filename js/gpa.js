/**
 * GPA+ 校园学业助手 —— 核心计算层
 * 纯函数实现，不依赖 DOM / localStorage，因此可以在 Node.js 中直接单元测试。
 * 加载方式（UMD-lite）：
 *   - 浏览器：作为经典脚本加载，挂载到 window.GPA
 *   - Node.js：require('./gpa.js') 直接拿到导出对象
 */
(function (global) {
  'use strict';

  /** 等级制成绩 → 百分制（常见高校约定，可按学校政策调整） */
  const GRADE_TO_SCORE = {
    优秀: 95,
    良好: 85,
    中等: 75,
    及格: 65,
    不及格: 0,
  };

  /** 4.0 分档制：分数下限 → 绩点（参考美式标准，分数达到下限即取该档） */
  const BRACKETS_4 = [
    [90, 4.0],
    [85, 3.7],
    [82, 3.3],
    [78, 3.0],
    [75, 2.7],
    [72, 2.3],
    [68, 2.0],
    [64, 1.7],
    [60, 1.0],
  ];

  /**
   * 解析用户输入的成绩，返回百分制分数；无法识别返回 null。
   * 支持：92 / 88.5 / 92分 / 优秀 / 良好 / 中等 / 及格 / 不及格
   * @param {string|number|null} input
   * @returns {number|null}
   */
  function parseScore(input) {
    if (input == null) return null;
    const s = String(input).trim();
    if (Object.prototype.hasOwnProperty.call(GRADE_TO_SCORE, s)) {
      return GRADE_TO_SCORE[s];
    }
    const m = s.match(/^(\d{1,3}(?:\.\d+)?)\s*分?$/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    }
    return null;
  }

  /** 4.0 分档制：百分制 → 绩点（低于 60 或非法输入记 0） */
  function scoreToPoint4(score) {
    if (!Number.isFinite(score) || score < 60) return 0;
    for (const [min, point] of BRACKETS_4) {
      if (score >= min) return point;
    }
    return 0;
  }

  /** 5.0 连续制：绩点 = (分数 − 50) / 10，低于 60 记 0 */
  function scoreToPoint5(score) {
    if (!Number.isFinite(score) || score < 60) return 0;
    return Math.min(5, (score - 50) / 10);
  }

  /** 按算法取绩点；mode 为 '5.0' 时用连续制，其余（含未知值）回退 4.0 分档制 */
  function scoreToPoint(score, mode) {
    return mode === '5.0' ? scoreToPoint5(score) : scoreToPoint4(score);
  }

  /** 保留两位小数（四舍五入） */
  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  /**
   * 汇总统计：过滤无效课程后计算加权平均分与 GPA
   * @param {Array<{credits:number, score:number}>} courses
   * @param {'4.0'|'5.0'} mode
   * @returns {{courseCount:number, totalCredits:number, weightedAverage:number|null, gpa:number|null}}
   */
  function computeStats(courses, mode) {
    const valid = (courses || []).filter(
      (c) => c && Number.isFinite(c.credits) && c.credits > 0 && Number.isFinite(c.score)
    );
    if (valid.length === 0) {
      return { courseCount: 0, totalCredits: 0, weightedAverage: null, gpa: null };
    }
    const totalCredits = valid.reduce((sum, c) => sum + c.credits, 0);
    const scoreSum = valid.reduce((sum, c) => sum + c.credits * c.score, 0);
    const pointSum = valid.reduce((sum, c) => sum + c.credits * scoreToPoint(c.score, mode), 0);
    return {
      courseCount: valid.length,
      totalCredits,
      weightedAverage: round2(scoreSum / totalCredits),
      gpa: round2(pointSum / totalCredits),
    };
  }

  const GPA = { parseScore, scoreToPoint4, scoreToPoint5, scoreToPoint, computeStats, round2 };

  global.GPA = GPA;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GPA;
  }
})(typeof window !== 'undefined' ? window : globalThis);
