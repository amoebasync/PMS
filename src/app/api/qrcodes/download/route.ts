import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = searchParams.get('data');
  const format = searchParams.get('format') || 'png';
  const transparent = searchParams.get('transparent') === 'true';

  if (!data) return NextResponse.json({ error: 'Missing data parameter' }, { status: 400 });

  // 背景透過やSVGに対応している「QuickChart API」を利用
  // transparent=1 の時はQRコードの周りの余白(margin)を0にすると使いやすいです
  const margin = transparent ? 0 : 2;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(data)}&size=500&format=${format}&margin=${margin}${transparent ? '&transparent=1' : ''}`;

  try {
    const res = await fetch(qrUrl);
    if (!res.ok) throw new Error('Failed to fetch QR code image');
    
    const arrayBuffer = await res.arrayBuffer();

    // Content-Disposition で "attachment" を指定することで、ブラウザに「強制ダウンロード」を指示する
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': format === 'svg' ? 'image/svg+xml' : 'image/png',
        'Content-Disposition': `attachment; filename="QRCode.${format}"`,
      },
    });
  } catch (error) {
    console.error('Download QR Error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}