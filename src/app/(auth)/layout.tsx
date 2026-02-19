export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // ここにはサイドバーなどを入れず、children（ログイン画面）だけを描画する
    <div className="min-h-screen bg-[#0f172a]">
      {children}
    </div>
  );
}