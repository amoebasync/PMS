import { NextResponse } from 'next/server';

// ポータル向けQRコード画像ダウンロードエンドポイント
// QuickChart APIを利用してQRコード画像を生成し、強制ダウンロードさせる
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = searchParams.get('data');
  const format = searchParams.get('format') || 'png';
  const transparent = searchParams.get('transparent') === 'true';
  const alias = searchParams.get('alias') || 'QRCode';

  if (!data) {
    return NextResponse.json({ error: 'dataパラメータが必要です' }, { status: 400 });
  }

  const margin = transparent ? 0 : 2;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(data)}&size=500&format=${format}&margin=${margin}${transparent ? '&transparent=1' : ''}`;

  try {
    const res = await fetch(qrUrl);
    if (!res.ok) throw new Error('QR画像の取得に失敗しました');

    const arrayBuffer = await res.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': format === 'svg' ? 'image/svg+xml' : 'image/png',
        'Content-Disposition': `attachment; filename="QR_${alias}.${format}"`,
      },
    });
  } catch (error) {
    console.error('Portal QR Download Error:', error);
    return NextResponse.json({ error: 'ダウンロードに失敗しました' }, { status: 500 });
  }
}
