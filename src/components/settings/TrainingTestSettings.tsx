'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n/useTranslation';
import { useNotification } from '@/components/ui/NotificationProvider';
import TrainingQuestionModal, { QuestionData } from './TrainingQuestionModal';

type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'IMAGE';
type ActiveFilter = 'all' | 'active' | 'inactive';
type ResultFilter = 'all' | 'pass' | 'fail';

type TestResult = {
  id: number;
  score: number;
  totalQuestions: number;
  isPassed: boolean;
  completedAt: string;
  assignment: {
    distributor: {
      id: number;
      staffId: string | null;
      name: string;
    };
  };
};

const TYPE_BADGE: Record<QuestionType, { cls: string; label: string }> = {
  MULTIPLE_CHOICE: { cls: 'bg-blue-100 text-blue-700', label: '4択' },
  TRUE_FALSE: { cls: 'bg-green-100 text-green-700', label: '○×' },
  IMAGE: { cls: 'bg-purple-100 text-purple-700', label: '画像' },
};

export default function TrainingTestSettings() {
  const { t } = useTranslation('settings');
  const { showToast, showConfirm } = useNotification();

  // テスト設定
  const [questionCount, setQuestionCount] = useState('10');
  const [passingRate, setPassingRate] = useState('80');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // 問題プール
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<QuestionData | undefined>(undefined);

  // テスト結果
  const [results, setResults] = useState<TestResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');

  // テスト設定の読み込み
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/system');
      if (res.ok) {
        const d = await res.json();
        if (d.trainingTestQuestionCount) setQuestionCount(d.trainingTestQuestionCount);
        if (d.trainingTestPassingRate) setPassingRate(d.trainingTestPassingRate);
      }
    } catch (e) {
      console.error(e);
    }
    setSettingsLoaded(true);
  }, []);

  // 問題プールの読み込み
  const fetchQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    try {
      const res = await fetch('/api/training-questions');
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
      }
    } catch (e) {
      console.error(e);
    }
    setQuestionsLoading(false);
  }, []);

  // テスト結果の読み込み
  const fetchResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const res = await fetch('/api/training-test-results');
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (e) {
      console.error(e);
    }
    setResultsLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchQuestions();
    fetchResults();
  }, [fetchSettings, fetchQuestions, fetchResults]);

  // テスト設定保存
  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await Promise.all([
        fetch('/api/settings/system', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'trainingTestQuestionCount', value: questionCount }),
        }),
        fetch('/api/settings/system', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'trainingTestPassingRate', value: passingRate }),
        }),
      ]);
      showToast(t('toast_legal_saved'), 'success');
    } catch {
      showToast(t('toast_save_error'), 'error');
    }
    setSettingsSaving(false);
  };

  // 問題削除
  const handleDeleteQuestion = async (question: QuestionData) => {
    const ok = await showConfirm(t('test_delete_confirm'), { variant: 'danger', confirmLabel: t('btn_delete_confirm') });
    if (!ok) return;
    try {
      const res = await fetch(`/api/training-questions/${question.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(t('toast_deleted'), 'success');
        await fetchQuestions();
      } else {
        const d = await res.json();
        showToast(d.error || t('toast_delete_error'), 'error');
      }
    } catch {
      showToast(t('toast_delete_error'), 'error');
    }
  };

  // フィルタ済み問題
  const filteredQuestions = questions.filter(q => {
    if (activeFilter === 'active') return q.isActive;
    if (activeFilter === 'inactive') return !q.isActive;
    return true;
  });

  // フィルタ済み結果
  const filteredResults = results.filter(r => {
    if (resultFilter === 'pass') return r.isPassed;
    if (resultFilter === 'fail') return !r.isPassed;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Section 1: テスト設定 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <i className="bi bi-sliders text-indigo-500"></i>
            {t('test_settings_title')}
          </h2>
        </div>
        <div className="p-5">
          {!settingsLoaded ? (
            <div className="flex items-center text-slate-400 gap-2 py-4">
              <i className="bi bi-hourglass-split animate-spin"></i>
              読み込み中...
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">{t('test_question_count')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={questionCount}
                    onChange={e => setQuestionCount(e.target.value)}
                    className="border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-24 text-center"
                  />
                  <span className="text-sm text-slate-500">問</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">{t('test_passing_rate')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={passingRate}
                    onChange={e => setPassingRate(e.target.value)}
                    className="border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-24 text-center"
                  />
                  <span className="text-sm text-slate-500">%</span>
                </div>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {settingsSaving ? (
                  <>
                    <i className="bi bi-hourglass-split animate-spin"></i>
                    {t('saving')}
                  </>
                ) : (
                  <>
                    <i className="bi bi-floppy"></i>
                    {t('btn_save')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: 問題プール */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <i className="bi bi-collection text-slate-500"></i>
            {t('test_question_pool')}
            {!questionsLoading && (
              <span className="text-slate-400 font-normal">({questions.length}{t('count_items')})</span>
            )}
          </h2>
          <button
            onClick={() => { setEditQuestion(undefined); setQuestionModalOpen(true); }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-indigo-700 flex items-center gap-2 shrink-0"
          >
            <i className="bi bi-plus-lg"></i>
            {t('test_add_question')}
          </button>
        </div>

        {/* フィルタ */}
        <div className="px-5 py-3 border-b border-slate-100 flex gap-2">
          {(['all', 'active', 'inactive'] as ActiveFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                activeFilter === f
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {f === 'all' ? t('test_all') : f === 'active' ? t('test_active_only') : t('test_inactive_only')}
            </button>
          ))}
        </div>

        {questionsLoading ? (
          <div className="flex items-center justify-center h-24 text-slate-400">
            <i className="bi bi-hourglass-split animate-spin text-xl mr-2"></i>
            読み込み中...
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <i className="bi bi-collection text-4xl block mb-2"></i>
            <p className="text-sm">{t('test_no_questions')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">{t('test_question_type')}</th>
                  <th className="px-5 py-3 text-left">{t('test_question_text')}</th>
                  <th className="px-5 py-3 text-center">{t('label_active_inactive')}</th>
                  <th className="px-5 py-3 text-center w-28">{t('label_operations')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuestions.map(q => {
                  const badge = TYPE_BADGE[q.type as QuestionType] || TYPE_BADGE.MULTIPLE_CHOICE;
                  return (
                    <tr key={q.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-700">
                        {q.questionJa.length > 40 ? q.questionJa.slice(0, 40) + '…' : q.questionJa}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="flex items-center justify-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${q.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                          <span className="text-xs text-slate-500">{q.isActive ? t('test_active') : t('test_inactive')}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => { setEditQuestion(q); setQuestionModalOpen(true); }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 px-2 py-1 rounded-lg"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q)}
                            className="text-xs text-rose-500 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 px-2 py-1 rounded-lg"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: テスト結果 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <i className="bi bi-bar-chart-line text-slate-500"></i>
            {t('test_results_title')}
            {!resultsLoading && (
              <span className="text-slate-400 font-normal">({results.length}{t('count_items')})</span>
            )}
          </h2>
          <button
            onClick={fetchResults}
            className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
            disabled={resultsLoading}
          >
            <i className={`bi bi-arrow-clockwise ${resultsLoading ? 'animate-spin' : ''}`}></i>
            更新
          </button>
        </div>

        {/* フィルタ */}
        <div className="px-5 py-3 border-b border-slate-100 flex gap-2">
          {(['all', 'pass', 'fail'] as ResultFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setResultFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                resultFilter === f
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {f === 'all' ? t('test_all') : f === 'pass' ? t('test_result_pass') : t('test_result_fail')}
            </button>
          ))}
        </div>

        {resultsLoading ? (
          <div className="flex items-center justify-center h-24 text-slate-400">
            <i className="bi bi-hourglass-split animate-spin text-xl mr-2"></i>
            読み込み中...
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <i className="bi bi-bar-chart-line text-4xl block mb-2"></i>
            <p className="text-sm">{t('test_no_results')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">配布員名</th>
                  <th className="px-5 py-3 text-left">スタッフID</th>
                  <th className="px-5 py-3 text-center">{t('test_score')}</th>
                  <th className="px-5 py-3 text-center">結果</th>
                  <th className="px-5 py-3 text-center">{t('test_taken_at')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map(r => {
                  const scorePercent = r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100) : 0;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {r.assignment?.distributor?.name || '—'}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">
                        {r.assignment?.distributor?.staffId || '—'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="font-bold">{r.score}/{r.totalQuestions}</span>
                        <span className="text-slate-400 text-xs ml-1">({scorePercent}%)</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {r.isPassed ? t('test_result_pass') : t('test_result_fail')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center text-xs text-slate-500">
                        {r.completedAt
                          ? new Date(r.completedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 問題モーダル */}
      <TrainingQuestionModal
        isOpen={questionModalOpen}
        onClose={() => setQuestionModalOpen(false)}
        onSaved={fetchQuestions}
        editQuestion={editQuestion}
      />
    </div>
  );
}
