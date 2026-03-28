'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n/useTranslation';
import { useNotification } from '@/components/ui/NotificationProvider';

type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'IMAGE';

type Choice = {
  choiceTextJa: string;
  choiceTextEn: string;
  isCorrect: boolean;
  sortOrder: number;
};

export type QuestionData = {
  id?: number;
  type: QuestionType;
  questionJa: string;
  questionEn: string;
  imageUrl?: string | null;
  explanationJa: string;
  explanationEn: string;
  isActive: boolean;
  sortOrder?: number;
  choices: Choice[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editQuestion?: QuestionData;
};

const inp = 'w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500';

function makeDefaultChoices(type: QuestionType): Choice[] {
  if (type === 'TRUE_FALSE') {
    return [
      { choiceTextJa: '正しい', choiceTextEn: 'True', isCorrect: true, sortOrder: 1 },
      { choiceTextJa: '間違い', choiceTextEn: 'False', isCorrect: false, sortOrder: 2 },
    ];
  }
  return [
    { choiceTextJa: '', choiceTextEn: '', isCorrect: false, sortOrder: 1 },
    { choiceTextJa: '', choiceTextEn: '', isCorrect: false, sortOrder: 2 },
    { choiceTextJa: '', choiceTextEn: '', isCorrect: false, sortOrder: 3 },
    { choiceTextJa: '', choiceTextEn: '', isCorrect: false, sortOrder: 4 },
  ];
}

export default function TrainingQuestionModal({ isOpen, onClose, onSaved, editQuestion }: Props) {
  const { t } = useTranslation('settings');
  const { showToast } = useNotification();

  const [type, setType] = useState<QuestionType>('MULTIPLE_CHOICE');
  const [questionJa, setQuestionJa] = useState('');
  const [questionEn, setQuestionEn] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [explanationJa, setExplanationJa] = useState('');
  const [explanationEn, setExplanationEn] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [choices, setChoices] = useState<Choice[]>(makeDefaultChoices('MULTIPLE_CHOICE'));
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editQuestion) {
      setType(editQuestion.type);
      setQuestionJa(editQuestion.questionJa);
      setQuestionEn(editQuestion.questionEn);
      setImageUrl(editQuestion.imageUrl || '');
      setExplanationJa(editQuestion.explanationJa);
      setExplanationEn(editQuestion.explanationEn);
      setIsActive(editQuestion.isActive);
      setChoices(
        editQuestion.choices.length > 0
          ? editQuestion.choices
          : makeDefaultChoices(editQuestion.type)
      );
    } else {
      setType('MULTIPLE_CHOICE');
      setQuestionJa('');
      setQuestionEn('');
      setImageUrl('');
      setExplanationJa('');
      setExplanationEn('');
      setIsActive(true);
      setChoices(makeDefaultChoices('MULTIPLE_CHOICE'));
    }
  }, [isOpen, editQuestion]);

  const handleTypeChange = (newType: QuestionType) => {
    setType(newType);
    setChoices(makeDefaultChoices(newType));
    if (newType !== 'IMAGE') setImageUrl('');
  };

  const handleChoiceTextChange = (index: number, field: 'choiceTextJa' | 'choiceTextEn', value: string) => {
    setChoices(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const handleCorrectChange = (index: number) => {
    setChoices(prev => prev.map((c, i) => ({ ...c, isCorrect: i === index })));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/training-questions/upload-image', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setImageUrl(data.imageUrl);
      } else {
        const d = await res.json();
        showToast(d.error || '画像のアップロードに失敗しました', 'error');
      }
    } catch {
      showToast('画像のアップロードに失敗しました', 'error');
    }
    setImageUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload: QuestionData = {
      type,
      questionJa,
      questionEn,
      imageUrl: type === 'IMAGE' ? imageUrl : null,
      explanationJa,
      explanationEn,
      isActive,
      choices,
    };

    try {
      const url = editQuestion?.id ? `/api/training-questions/${editQuestion.id}` : '/api/training-questions';
      const method = editQuestion?.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(editQuestion?.id ? '問題を更新しました' : '問題を追加しました', 'success');
        onSaved();
        onClose();
      } else {
        const d = await res.json();
        showToast(d.error || t('toast_save_error'), 'error');
      }
    } catch {
      showToast(t('toast_save_error'), 'error');
    }
    setSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-pencil-square text-indigo-500"></i>
            {editQuestion?.id ? t('test_edit_question') : t('test_add_question')}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <i className="bi bi-x-lg text-lg"></i>
          </button>
        </div>

        {/* スクロール領域 */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* 種別 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('test_question_type')}</label>
            <div className="flex gap-2">
              {(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'IMAGE'] as QuestionType[]).map(qt => (
                <button
                  key={qt}
                  type="button"
                  onClick={() => handleTypeChange(qt)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                    type === qt
                      ? qt === 'MULTIPLE_CHOICE'
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : qt === 'TRUE_FALSE'
                        ? 'bg-green-100 text-green-700 border-green-300'
                        : 'bg-purple-100 text-purple-700 border-purple-300'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {qt === 'MULTIPLE_CHOICE' ? t('test_type_mc') : qt === 'TRUE_FALSE' ? t('test_type_tf') : t('test_type_image')}
                </button>
              ))}
            </div>
          </div>

          {/* 問題文 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{t('test_question_text_ja')}</label>
              <textarea
                value={questionJa}
                onChange={e => setQuestionJa(e.target.value)}
                rows={3}
                className={inp}
                placeholder="日本語の問題文を入力"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{t('test_question_text_en')}</label>
              <textarea
                value={questionEn}
                onChange={e => setQuestionEn(e.target.value)}
                rows={3}
                className={inp}
                placeholder="Enter question in English"
                required
              />
            </div>
          </div>

          {/* 画像（IMAGEタイプのみ） */}
          {type === 'IMAGE' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{t('test_image')}</label>
              <div className="flex items-start gap-3">
                <label className="cursor-pointer border border-slate-300 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 flex items-center gap-2">
                  <i className="bi bi-image"></i>
                  {imageUploading ? 'アップロード中...' : '画像を選択'}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={imageUploading} />
                </label>
                {imageUrl && (
                  <div className="flex-1">
                    <img src={imageUrl} alt="preview" className="max-h-32 rounded-lg border border-slate-200 object-contain" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 選択肢 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('test_choices')}</label>
            <div className="space-y-2">
              {choices.map((choice, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="correct"
                    checked={choice.isCorrect}
                    onChange={() => handleCorrectChange(i)}
                    className="w-4 h-4 text-indigo-600 shrink-0"
                    title={t('test_correct_answer')}
                  />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={choice.choiceTextJa}
                      onChange={e => handleChoiceTextChange(i, 'choiceTextJa', e.target.value)}
                      placeholder={`選択肢 ${i + 1}（日本語）`}
                      className={`${inp} ${type === 'TRUE_FALSE' ? 'bg-slate-50' : ''}`}
                      readOnly={type === 'TRUE_FALSE'}
                    />
                    <input
                      type="text"
                      value={choice.choiceTextEn}
                      onChange={e => handleChoiceTextChange(i, 'choiceTextEn', e.target.value)}
                      placeholder={`Choice ${i + 1} (English)`}
                      className={`${inp} ${type === 'TRUE_FALSE' ? 'bg-slate-50' : ''}`}
                      readOnly={type === 'TRUE_FALSE'}
                    />
                  </div>
                  {choice.isCorrect && (
                    <span className="shrink-0 text-xs text-emerald-600 font-bold flex items-center gap-1">
                      <i className="bi bi-check-circle-fill"></i>
                      {t('test_correct_answer')}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              <i className="bi bi-info-circle mr-1"></i>
              ラジオボタンを選択して正解を指定してください
            </p>
          </div>

          {/* 解説 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{t('test_explanation_ja')}</label>
              <textarea
                value={explanationJa}
                onChange={e => setExplanationJa(e.target.value)}
                rows={3}
                className={inp}
                placeholder="日本語の解説を入力"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{t('test_explanation_en')}</label>
              <textarea
                value={explanationEn}
                onChange={e => setExplanationEn(e.target.value)}
                rows={3}
                className={inp}
                placeholder="Enter explanation in English"
                required
              />
            </div>
          </div>

          {/* 有効/無効 */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600"
              />
              <span className="text-sm font-bold text-slate-700">{t('test_active')}</span>
            </label>
          </div>
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-3 p-5 border-t border-slate-100 shrink-0 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-300 px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
            disabled={submitting}
          >
            {t('btn_cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !questionJa || !questionEn || !explanationJa || !explanationEn}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <i className="bi bi-hourglass-split animate-spin"></i>
                {t('saving')}
              </>
            ) : (
              <>
                <i className="bi bi-floppy"></i>
                {editQuestion?.id ? t('btn_update') : t('btn_save')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
