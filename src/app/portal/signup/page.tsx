'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  
  const [accountType, setAccountType] = useState<'company' | 'individual'>('company');
  const [form, setForm] = useState({ 
    companyName: '', 
    lastName: '', 
    firstName: '', 
    email: '', 
    password: '', 
    confirmPassword: '' 
  });
  
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const hasUpper = /[A-Z]/.test(form.password);
  const hasLower = /[a-z]/.test(form.password);
  const hasNumOrSym = /[0-9!@#$%^&*(),.?":{}|<>\-_]/.test(form.password);
  const isLongEnough = form.password.length >= 8;
  const passwordsMatch = form.password === form.confirmPassword && form.password !== '';
  const isPasswordValid = hasUpper && hasLower && hasNumOrSym && isLongEnough;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); 
    setErrorMsg('');

    if (!isPasswordValid) {
      setErrorMsg('パスワードが要件を満たしていません。');
      setLoading(false);
      return;
    }

    if (!passwordsMatch) {
      setErrorMsg('パスワードが一致しません。');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/portal/register', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, accountType })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      const signInRes = await signIn('credentials', {
        redirect: false,
        email: form.email,
        password: form.password,
      });

      if (signInRes?.ok) {
        router.push('/portal/mypage');
        router.refresh();
      } else {
        throw new Error('自動ログインに失敗しました。ログイン画面からお試しください。');
      }

    } catch (err: any) {
      setErrorMsg(err.message || 'エラーが発生しました');
      setLoading(false);
    }
  };

  const RuleIndicator = ({ isValid, text }: { isValid: boolean, text: string }) => (
    <div className={`flex items-center gap-1.5 text-xs transition-colors duration-300 ${isValid ? 'text-emerald-600' : 'text-slate-400'}`}>
      <i className={`bi ${isValid ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
      <span>{text}</span>
    </div>
  );

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 py-12">
      
      {/* ★ 追加: トップページへ戻るリンク */}
      <Link href="/portal" className="mb-6 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-2">
        <i className="bi bi-arrow-left"></i> トップページへ戻る
      </Link>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-[180px] h-[45px] mb-4">
            {/* ★ 変更: 白背景用のロゴに変更 */}
            <Image src="/logo/logo_light_transparent.png" alt="Logo" fill className="object-contain" priority />
          </div>
          <h1 className="text-xl font-bold text-slate-800">新規アカウント登録</h1>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-bold flex items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill"></i>
            {errorMsg}
          </div>
        )}

        <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
          <button 
            type="button"
            onClick={() => setAccountType('company')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${accountType === 'company' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            法人のお客様
          </button>
          <button 
            type="button"
            onClick={() => setAccountType('individual')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${accountType === 'individual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            個人のお客様
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {accountType === 'company' && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">会社名・組織名 <span className="text-rose-500">*</span></label>
              <input type="text" required value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm font-medium transition-all" placeholder="株式会社〇〇" />
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">姓 <span className="text-rose-500">*</span></label>
              <input type="text" required value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm font-medium transition-all" placeholder="山田" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">名 <span className="text-rose-500">*</span></label>
              <input type="text" required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm font-medium transition-all" placeholder="太郎" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">メールアドレス <span className="text-rose-500">*</span></label>
            <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm font-medium transition-all" placeholder="mail@example.com" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">パスワード <span className="text-rose-500">*</span></label>
            <input type="password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm font-medium transition-all" placeholder="••••••••" />
            
            <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100 grid grid-cols-2 gap-2">
              <RuleIndicator isValid={isLongEnough} text="8文字以上" />
              <RuleIndicator isValid={hasUpper} text="大文字を含む" />
              <RuleIndicator isValid={hasLower} text="小文字を含む" />
              <RuleIndicator isValid={hasNumOrSym} text="数字または記号を含む" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">パスワード (再確認) <span className="text-rose-500">*</span></label>
            <div className="relative">
              <input type="password" required value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:bg-white outline-none text-sm font-medium transition-all ${form.confirmPassword ? (passwordsMatch ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500' : 'border-rose-500 focus:ring-2 focus:ring-rose-500') : 'border-slate-200 focus:ring-2 focus:ring-indigo-500'}`} placeholder="••••••••" />
              {form.confirmPassword && (
                <i className={`bi absolute right-4 top-1/2 -translate-y-1/2 text-lg ${passwordsMatch ? 'bi-check-circle-fill text-emerald-500' : 'bi-x-circle-fill text-rose-500'}`}></i>
              )}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || !isPasswordValid || !passwordsMatch} 
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登録中...' : '無料で登録する'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-500 font-medium">
          すでにアカウントをお持ちですか？ <Link href="/portal/login" className="text-indigo-600 hover:underline font-bold">ログインはこちら</Link>
        </div>
      </div>
    </div>
  );
}