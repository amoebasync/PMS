'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

// ===== Types =====
type PastResult = {
  id: number;
  score: number;
  totalQuestions: number;
  isPassed: boolean;
  attemptNumber: number;
  completedAt: string | null;
};

type HomeData = {
  pendingAssignment: { id: number; assignedAt: string } | null;
  isTrainingTestPassed: boolean;
  pastResults: PastResult[];
};

type Choice = {
  id: number;
  text: string;
};

type Question = {
  id: number;
  type: string;
  question: string;
  imageUrl?: string | null;
  choices: Choice[];
};

type AnswerFeedback = {
  isCorrect: boolean;
  correctChoiceId: number | null;
  explanation: string | null;
};

type ResultSummary = {
  score: number;
  totalQuestions: number;
  isPassed: boolean;
  passingScore: number;
};

// answers stored locally for summary display
type LocalAnswer = {
  questionId: number;
  questionText: string;
  isCorrect: boolean;
};

type Phase = 'home' | 'quiz' | 'result';

// ===== Loading Skeleton =====
function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-32 bg-slate-200 rounded animate-pulse"></div>
      <div className="h-24 bg-slate-200 rounded-2xl animate-pulse"></div>
      <div className="h-24 bg-slate-200 rounded-2xl animate-pulse"></div>
    </div>
  );
}

// ===== Home Phase =====
function HomePhase({
  data,
  onStart,
  starting,
}: {
  data: HomeData;
  onStart: () => void;
  starting: boolean;
}) {
  const { pendingAssignment, isTrainingTestPassed, pastResults } = data;

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
        <i className="bi bi-pencil-square text-indigo-500"></i>
        研修テスト
      </h1>

      {/* Pending assignment card */}
      {pendingAssignment && (
        <div className="bg-indigo-600 rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-start gap-3 mb-4">
            <i className="bi bi-bell-fill text-2xl mt-0.5 shrink-0"></i>
            <div>
              <p className="font-black text-base leading-tight">研修テストが届いています</p>
              <p className="text-indigo-200 text-xs mt-1">
                {new Date(pendingAssignment.assignedAt).toLocaleDateString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                に割り当てられました
              </p>
            </div>
          </div>
          <button
            onClick={onStart}
            disabled={starting}
            className="w-full bg-white text-indigo-600 font-black rounded-xl py-3 text-sm min-h-[48px] active:opacity-80 disabled:opacity-60 transition-opacity"
          >
            {starting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                準備中...
              </span>
            ) : (
              'テストを受験する'
            )}
          </button>
        </div>
      )}

      {/* Passed badge */}
      {isTrainingTestPassed && !pendingAssignment && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <i className="bi bi-check-lg text-white text-xl font-bold"></i>
          </div>
          <div>
            <p className="font-black text-emerald-700 text-base">研修テスト合格済み</p>
            <p className="text-emerald-600 text-xs mt-0.5">おめでとうございます！</p>
          </div>
        </div>
      )}

      {/* No test pending and not passed yet */}
      {!pendingAssignment && !isTrainingTestPassed && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 text-center">
          <i className="bi bi-hourglass text-3xl text-slate-300 mb-2 block"></i>
          <p className="text-sm text-slate-400">現在テストの割当はありません</p>
        </div>
      )}

      {/* Past results */}
      {pastResults.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-600 mb-3 px-1">過去の受験結果</h2>
          <div className="space-y-2">
            {pastResults.map((r) => (
              <div
                key={r.id}
                className={`rounded-2xl border p-4 flex items-center gap-4 ${
                  r.isPassed
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-rose-50 border-rose-200'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-sm ${
                    r.isPassed ? 'bg-emerald-500 text-white' : 'bg-rose-400 text-white'
                  }`}
                >
                  {r.isPassed ? '合' : '不'}
                </div>
                <div className="flex-1">
                  <p className={`font-bold text-sm ${r.isPassed ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {r.score}/{r.totalQuestions} 点
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                    }`}>
                      {r.isPassed ? '合格' : '不合格'}
                    </span>
                  </p>
                  {r.completedAt && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(r.completedAt).toLocaleDateString('ja-JP', {
                        timeZone: 'Asia/Tokyo',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <span className="text-xs text-slate-400">第{r.attemptNumber}回</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Quiz Phase =====
function QuizPhase({
  questions,
  resultId,
  assignmentId,
  onComplete,
  onRetry,
}: {
  questions: Question[];
  resultId: number;
  assignmentId: number;
  onComplete: (result: ResultSummary, localAnswers: LocalAnswer[]) => void;
  onRetry: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localAnswers, setLocalAnswers] = useState<LocalAnswer[]>([]);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const progress = ((currentIndex + 1) / questions.length) * 100;

  async function submitAnswer() {
    if (!selectedChoiceId || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/training-test/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultId,
          questionId: currentQuestion.id,
          choiceId: selectedChoiceId,
        }),
      });
      if (res.ok) {
        const data: AnswerFeedback = await res.json();
        setFeedback(data);
        setLocalAnswers((prev) => [
          ...prev,
          {
            questionId: currentQuestion.id,
            questionText: currentQuestion.question,
            isCorrect: data.isCorrect,
          },
        ]);
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  }

  async function nextQuestion() {
    if (isLast) {
      // Complete the test
      try {
        const res = await fetch('/api/staff/training-test/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resultId }),
        });
        if (res.ok) {
          const result: ResultSummary = await res.json();
          onComplete(result, localAnswers);
        }
      } catch { /* ignore */ }
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedChoiceId(null);
      setFeedback(null);
    }
  }

  void assignmentId; // used by parent to restart

  return (
    <div className="flex flex-col gap-4">
      {/* Progress bar */}
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Question counter */}
      <p className="text-sm text-slate-500 font-medium text-center">
        問題 {currentIndex + 1} / {questions.length}
      </p>

      {/* Question text */}
      <p className="text-lg font-semibold text-slate-800 leading-snug">
        {currentQuestion.question}
      </p>

      {/* Question image */}
      {currentQuestion.imageUrl && (
        <div
          className="w-full rounded-xl overflow-hidden cursor-pointer"
          onClick={() => setZoomImage(currentQuestion.imageUrl!)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentQuestion.imageUrl}
            alt="問題画像"
            className="w-full rounded-xl"
          />
          <p className="text-xs text-slate-400 text-center mt-1">タップで拡大</p>
        </div>
      )}

      {/* Choices */}
      <div className="space-y-2">
        {currentQuestion.choices.map((choice) => {
          let cls = 'border rounded-xl p-4 text-left w-full min-h-[48px] text-base transition-colors ';
          if (!feedback) {
            // Before answering
            if (selectedChoiceId === choice.id) {
              cls += 'border-indigo-500 bg-indigo-50 text-indigo-800 font-medium';
            } else {
              cls += 'border-slate-200 bg-white text-slate-700';
            }
          } else {
            // After answering — show correct/incorrect
            if (choice.id === feedback.correctChoiceId) {
              cls += 'border-emerald-500 bg-emerald-50 text-emerald-800 font-medium';
            } else if (choice.id === selectedChoiceId && !feedback.isCorrect) {
              cls += 'border-rose-400 bg-rose-50 text-rose-700';
            } else {
              cls += 'border-slate-200 bg-white text-slate-400';
            }
          }

          return (
            <button
              key={choice.id}
              className={cls}
              disabled={!!feedback}
              onClick={() => !feedback && setSelectedChoiceId(choice.id)}
            >
              <span className="flex items-center gap-3">
                {feedback && choice.id === feedback.correctChoiceId && (
                  <i className="bi bi-check-circle-fill text-emerald-500 text-lg shrink-0"></i>
                )}
                {feedback && choice.id === selectedChoiceId && !feedback.isCorrect && (
                  <i className="bi bi-x-circle-fill text-rose-400 text-lg shrink-0"></i>
                )}
                {feedback && choice.id !== feedback.correctChoiceId && choice.id !== selectedChoiceId && (
                  <span className="w-5 h-5 shrink-0"></span>
                )}
                {!feedback && (
                  <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    selectedChoiceId === choice.id ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                  }`}>
                    {selectedChoiceId === choice.id && (
                      <span className="w-2 h-2 rounded-full bg-white"></span>
                    )}
                  </span>
                )}
                {choice.text}
              </span>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {feedback && feedback.explanation && (
        <div className="bg-slate-50 rounded-xl p-4 mt-2">
          <p className="text-xs font-bold text-slate-500 mb-1">解説</p>
          <p className="text-sm text-slate-600 leading-relaxed">{feedback.explanation}</p>
        </div>
      )}

      {/* Submit / Next button */}
      {!feedback ? (
        <button
          onClick={submitAnswer}
          disabled={!selectedChoiceId || submitting}
          className={`w-full min-h-[48px] rounded-xl font-bold text-sm transition-opacity ${
            selectedChoiceId && !submitting
              ? 'bg-indigo-600 text-white active:opacity-80'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
              送信中...
            </span>
          ) : (
            '回答する'
          )}
        </button>
      ) : (
        <button
          onClick={nextQuestion}
          className="w-full min-h-[48px] rounded-xl bg-indigo-600 text-white font-bold text-sm active:opacity-80"
        >
          {isLast ? '結果を見る' : '次の問題へ'}
        </button>
      )}

      {/* Zoom modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomImage}
            alt="拡大表示"
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ===== Result Phase =====
function ResultPhase({
  result,
  localAnswers,
  onRetake,
}: {
  result: ResultSummary;
  localAnswers: LocalAnswer[];
  onRetake: () => void;
}) {
  const { score, totalQuestions, isPassed, passingScore } = result;

  return (
    <div className="space-y-5">
      {/* Score */}
      <div className={`rounded-2xl p-6 text-center ${isPassed ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-3 ${isPassed ? 'bg-emerald-500' : 'bg-rose-400'}`}>
          <i className={`text-4xl text-white ${isPassed ? 'bi bi-check-lg' : 'bi bi-x-lg'}`}></i>
        </div>
        <p className={`text-4xl font-bold mb-1 ${isPassed ? 'text-emerald-700' : 'text-rose-600'}`}>
          {score}/{totalQuestions}
        </p>
        <p className={`text-base font-bold ${isPassed ? 'text-emerald-700' : 'text-rose-600'}`}>
          {isPassed ? '合格！おめでとうございます！' : 'もう一度挑戦してください'}
        </p>
        <p className="text-xs text-slate-500 mt-2">
          合格ライン: {passingScore}/{totalQuestions}
        </p>
      </div>

      {/* Answer summary */}
      {localAnswers.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-600 mb-3 px-1">回答サマリー</h2>
          <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
            {localAnswers.map((a, i) => (
              <div key={a.questionId} className="flex items-start gap-3 p-4">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${a.isCorrect ? 'bg-emerald-500' : 'bg-rose-400'}`}>
                  <i className={`text-white text-xs ${a.isCorrect ? 'bi bi-check' : 'bi bi-x'}`}></i>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 mb-0.5">問題 {i + 1}</p>
                  <p className="text-sm text-slate-700 leading-snug line-clamp-2">{a.questionText}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        {!isPassed && (
          <button
            onClick={onRetake}
            className="w-full min-h-[48px] bg-indigo-600 text-white rounded-xl font-bold text-sm active:opacity-80"
          >
            もう一度受験する
          </button>
        )}
        <Link
          href="/staff"
          className="block w-full min-h-[48px] bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm text-center leading-[48px] active:bg-slate-50"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}

// ===== Main Page =====
export default function StaffTestPage() {
  const [phase, setPhase] = useState<Phase>('home');
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeData, setHomeData] = useState<HomeData | null>(null);

  // Quiz state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [resultId, setResultId] = useState<number>(0);
  const [assignmentId, setAssignmentId] = useState<number>(0);
  const [starting, setStarting] = useState(false);

  // Result state
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const [localAnswers, setLocalAnswers] = useState<LocalAnswer[]>([]);

  function loadHome() {
    setHomeLoading(true);
    fetch('/api/staff/training-test')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setHomeData(data);
      })
      .catch(() => {})
      .finally(() => setHomeLoading(false));
  }

  useEffect(() => {
    loadHome();
  }, []);

  async function handleStart() {
    if (!homeData?.pendingAssignment) return;
    setStarting(true);
    try {
      const res = await fetch('/api/staff/training-test/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: homeData.pendingAssignment.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
        setResultId(data.resultId);
        setAssignmentId(homeData.pendingAssignment.id);
        setPhase('quiz');
      }
    } catch { /* ignore */ }
    setStarting(false);
  }

  async function handleRetake() {
    // Re-fetch home to get latest pending assignment (may have been refreshed)
    setStarting(true);
    try {
      const homeRes = await fetch('/api/staff/training-test');
      if (homeRes.ok) {
        const data: HomeData = await homeRes.json();
        if (data.pendingAssignment) {
          const res = await fetch('/api/staff/training-test/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignmentId: data.pendingAssignment.id }),
          });
          if (res.ok) {
            const startData = await res.json();
            setQuestions(startData.questions);
            setResultId(startData.resultId);
            setAssignmentId(data.pendingAssignment.id);
            setLocalAnswers([]);
            setPhase('quiz');
          }
        }
      }
    } catch { /* ignore */ }
    setStarting(false);
  }

  function handleComplete(result: ResultSummary, answers: LocalAnswer[]) {
    setResultSummary(result);
    setLocalAnswers(answers);
    setPhase('result');
    // Reload home data in background
    loadHome();
  }

  if (phase === 'home') {
    if (homeLoading) return <Skeleton />;
    if (!homeData) {
      return (
        <div className="text-center text-slate-400 py-10">
          <p className="text-sm">データの取得に失敗しました</p>
        </div>
      );
    }
    return (
      <HomePhase
        data={homeData}
        onStart={handleStart}
        starting={starting}
      />
    );
  }

  if (phase === 'quiz') {
    return (
      <QuizPhase
        questions={questions}
        resultId={resultId}
        assignmentId={assignmentId}
        onComplete={handleComplete}
        onRetry={() => {
          setPhase('home');
          loadHome();
        }}
      />
    );
  }

  if (phase === 'result' && resultSummary) {
    return (
      <ResultPhase
        result={resultSummary}
        localAnswers={localAnswers}
        onRetake={handleRetake}
      />
    );
  }

  return null;
}
