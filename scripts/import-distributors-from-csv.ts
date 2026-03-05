/**
 * CSVから配布員マスタをPMSにインポートするスクリプト
 *
 * ルール:
 * 1. staffId が既に存在する場合 → スキップ（重複防止）
 * 2. 名前が一致するが staffId が違う場合 → staffId を CSV の値に更新
 * 3. それ以外 → 新規作成
 *
 * 実行: npx tsx scripts/import-distributors-from-csv.ts
 * 本番: SSH先で npx tsx scripts/import-distributors-from-csv.ts
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// ── TSV データ（タブ区切り） ──
const RAW_DATA = `Takadanobaba\tMBF1265\tRodrigo Goicoechea Monroy \t070 9187 2862\tprada21tokyo@gmail.com\t1983/01/02\t男性\tメキシコ\t5 7 Shin Ogawa cho, Shinjuku, Tokyo, Deki House, 305\t永住者\t2032/08/29\t○\t○\t○\t2026/02/17\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t0
Takadanobaba\tMBF1266\tDoridan N Bavangila\t9054335990\tbavangila_michael@yahoo.com\t2000/05/12\t男性\tイギリス\tConfort Ikebukuro 211, 4-16-19 Nishiikebukuro, Toshima City Tokyo 171-0021\t\t2026/10/21\t○\t○\t○\t2026/02/17\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tB\t\t2\t2\t2000\t2500\t¥13,000 or more\t徒歩\t\t0
Takadanobaba\tMBF1267\tAlejandro Cadenas Sanchez \t7084936801\talejandrocadsanjapan@gmail.com\t1996/12/25\t男性\tスパイン\t7-chōme-3 Negishidai, Asaka, Saitama 351-0005\t\t\t○\t○\t○\t2026/02/17\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥10,000–¥12,999\t徒歩\t\t0
Takadanobaba\tMBF1268\tMillicent Fatimatu Ayittah \t7089046841\tmillicentayittah9@gmail.com\t\t\tRose garden B2 1-17-7 Minamigyotoku Ichikawa shi Chiba \t\t\t○\t○\t○\t2026/02/17\t2026/02/25\t辞め\t振込\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥10,000–¥12,999\t徒歩\t\t0
Takadanobaba\tMBF1269\tOluranti Akodu\t7092234587\toakodu@gmail.com\t1991/02/05\t男性\tイギリス\t森田 麻由佳 〒335-0021 埼玉県戸田市新曽1040-1 和泉21 803号室\t\t2028/02/04\t○\t○\t○\t2026/2/18\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2\t2.75\t3.25\t4.5\t5.75\t7\t1000\tC\t\t2\t2\t2000\t2500\t¥13,000 or more\t徒歩\t\t0
Takadanobaba\tMBF1270\tDaniel Santos Jiménez \t7089722325\tdansantosjimenez@gmail.com\t1995/06/07\t男性\tスパイン\t4 Chome-5-29 Taishido, Setagaya City, Tokyo 154-0004, Japón\t\t\t○\t○\t○\t2026/02/18\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t0
Takadanobaba\tMBF1271\tLiana ZAOUI\t8107085218539\tLiana.zaoui@outlook.fr\t2001/06/08\t女性\tフランス\t〒156-0041 Tokyo, Setagaya City, Ōhara, 1-chōme−29−6 オリジンK・M\tワーホリ\t2027/01/12\t○\t○\t○\t2026/02/18\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥10,000–¥12,999\t徒歩\t\t0
Takadanobaba\tMBF1272\tCristóbal Ignacio Castro Olivares\t7091351871\tcristobal.coo@gmail.com\t1995/01/10\t男性\tチリ\tTaito-ku Nigishi 4-3-3 room 105\tワーホリ\t2027/02/02\t○\t○\t○\t2026/02/18\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥13,000 or more\t徒歩\t\t0
Takadanobaba\tMBF1273\tTanimola Fagbenle\t81 8081299996\ttanifagbenle@gmail.com\t2007/5/21\t男性\t\t5-18-18 Tajiri, Ichikawa-shi, Chiba 272-0014\t\t\t○\t○\t○\t2026/2/18\t2026/02/25\t辞め\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2\t2.75\t3.25\t4.5\t5.75\t7\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t0
Takadanobaba\tMBF1274\tRyan Sivyer\t08096993313\t1-26-8 Narimasu\t1982/08/02\t男性\tカナダ\t1-26-8 Narimasu\t日本人の配偶者\t2030/05/02\t○\t○\t○\t2026/2/19\t\t\t現金\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tC\t\t\t\t\t\t\t\t\t
Takadanobaba\tMBF1275\tWayne Andrew Roosevelt Chisolm\t9044640465\twrc4000@gmail.com\t1988/01/12\t男性\tアメリカ\tKanagawa, Kawasaki-shi, Kawasaki-ku, Kawasaki Asahicho Heights 1-2-5  210-0808\t永住者の配偶者\t2026/10/30\t○\t○\t○\t2026/02/19\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥13,000 or more\t徒歩\t\t0
Takadanobaba\tMBF1276\tLogan Travis Steven Griffiths \t7777734918\tlogangriffiths486@gmail.com\t2005/11/16\t男性\tイギリス\t123-0851 東京都足立区梅田1－22-9 第五山口マンション 201\tワーホリ\t2026/09/12\t○\t\t○\t2026/02/19\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥13,000 or more\t徒歩\t\t0
Takadanobaba\tMBF1287\tAungTunLin\t8038917975\tzeroking300@gmail.com\t1977/10/08\t男性\tミャンマー\t〒136-0076 東京都江東区南砂2-3-5-508\t定住者\t2026/11/05\t○\t○\t○\t2026/02/20\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥13,000 or more\t徒歩\t\t0
Takadanobaba\tMBF1288\tPan Phyu\t9060013929\tpanphyu1994@gmail.com\t1994/06/23\t女性\tミャンマー\t170-0004 Tokyoto Kita Otsuka 2-6-3 Mezonotsuka 602\tワーホリ\t2026/03/19\t○\t○\t○\t2026/02/20\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥13,000 or more\t徒歩\t\t0
Takadanobaba\tMBF1289\tKIM HYEONJONG\t7094442248\tk8197794@gmail.com\t1999/10/26\t男性\t韓国\t〒335-0023 埼玉県戸田市本町1丁目5-1 スカイコート戸田公園 303号室\tワーホリ\t\t○\t\t○\t2026/02/20\t\t\t振込\t\t１４８\t普通\t０４５１６４１\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tB\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t0
Takadanobaba\tMBF1290\tHAN JINHO\t8057114621\tip0130200@naver.com\t1994/03/10\t男性\t韓国\t埼玉県さいたま市北区日進町２丁目1346-9 Prairie Un 大宮　１０１号\tワーホリ\t\t○\t○\t○\t2026/02/20\t\t\t振込\tMUFG\t359\t普通\t0437994\tハン　ジンホ\tﾊﾝ ｼﾞﾝﾎ\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥10,000–¥12,999\t徒歩\t\t0
Takadanobaba\tMBF1291\tBustamante, David Ogas \t090-8946-8338 \tfuego83equi@yahoo.com\t1964/10/21\t男性\tアメリカ\t4 Chome-6, Asakusabashi, Taito-ku \t\t\t○\t\t○\t2026/02/20\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥13,000 or more\t徒歩\t\t0
Takadanobaba\tMBF1292\tEduardo Kazuyoshi Pedro Azeka\t7047997820\tchavesdau9@gmail.com\t1995/06/01\t男性\tブラジル\t〒130-0015 東京都墨田区横網２丁目６−7 ファーストシーン両国レジデンス\t定住者\t2026/10/17\t○\t○\t○\t2026/02/23\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥13,000 or more\t徒歩\t\t0
Takadanobaba\tMBF1293\tSruthi Raja Buridi (Shruti Raj) \t090-8562-8396\tshrutir125@gmail.com\t1983/12/25\t女性\tインド\t1340087 Tokyo , Edogawa ku , Seishincho 1-3-4-603 Seishin Plaza \t永住者\t2031/07/03\t○\t○\t○\t2026/02/23\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥13,000 or more\t徒歩\t\t0
Takadanobaba\tMBF1294\tYaël Lezwijn\t7085648856\tlezwijn1@gmail.com\t2006/02/13\t男性\tオランダ\t東京都稲城市大丸115番地の5 第一末広マンション401\tワーホリ\t2026/10/01\t○\t○\t○\t2026/02/23\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t0
Takadanobaba\tMBF1295\tIker Merino Gómez\t34685314250\tIkermerinog@gmail.com\t2002/05/11\t男性\tスペイン\t調布市西つつじケ丘1T目48番24 オークハウス調布204\tワーホリ\t2027/02/07\t○\t○\t○\t2026/02/23\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t0
Takadanobaba\tMBF1296\tSakura Angela Kaneko \t8057401262\tsramirez2007@icloud.com\t2007/09/09\t女性\t日本\tTokyo Nerima Nukui 4-47-23\t日本人\t\t○\t○\t○\t2026/02/24\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t0
Takadanobaba\tMBF1297\tBawi Lian Cung\t7084463922\twesleylian.van@gmail.com\t1993/02/09\t男性\tミャンマー\t19-3, Kitashinjuku 3-Chōme\tワーホリ\t2026/11/18\t○\t○\t○\t2026/02/24\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥5,000–¥7,999\t徒歩\t\t0
Takadanobaba\tMBF1298\tVivienne Nguyen\t09070482888\tvivienne.nguyen@hhu.de\t2000/11/28\t女性\tドイツ\t〒161-0034 東京都新宿区上落合3-25-6 第一ノーブルマンション401号室\tワーホリ\t2026/08/20\t○\t○\t○\t2026/02/24\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥5,000–¥7,999\t徒歩\t\t
Takadanobaba\tMBF1299\tXavier Martínez Pecino \t7091175589\tmartinezpecinox@gmail.com\t2001/01/25\t男性\tスペイン\t2 Chome-38-3 Kiyokawa, Taito City, Tokyo 111-0022, Japón\tワーホリ\t2026/11/05\t○\t○\t○\t2026/02/24\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥10,000–¥12,999\t徒歩\t\t0
Takadanobaba\tMBF1300\tPaulo Garcia Calero \t8055978562\tpaucalero2@gmail.com\t2002/03/21\t男性\tスペイン\tNishitsutsujigaoka 1 Chome. 1-48-24. Room 203.Chofu, Tokyo. \tワーホリ\t2027/02/05\t○\t○\t○\t2026/02/25\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t
Takadanobaba\tMBF1301\tHjalte Dominic Amstrup Hostrup\t7094421664\tHjaltehostrup@live.dk\t2003/08/14\t男性\tデンマーク\t〒352-0001 Saitama Prefecture, Niiza, Touhoku 2-chome-25-9\tワーホリ\t2027/01/06\t○\t○\t○\t2026/02/26\t\t\t振込\tゆうちょ銀行\t１４８\t普通\t０７０５１３８\tホストラップ　ヤルテ　ドミニク　アムストラップ\tﾎｽﾄﾗｯﾌﾟ ﾔﾙﾃ ﾄﾞﾐﾆｸ ｱﾑｽﾄﾗｯﾌﾟ\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t0
Takadanobaba\tMBF1302\tKaireddine Ghribi\t7091784614\tkaireddine.g@gmail.com\t1995/08/14\t男性\tフランス\t1-13-9 Itabashi, XE 401, Itabashi-ku 173-0004\t日本人の配偶者\t2026/11/18\t○\t○\t○\t2026/02/26\t\t\t振込\tSMBC\t619\t普通\t7695598\tKAIREDDINE GHRIBI\tKAIREDDINE GHRIBI\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥13,000 or more\t徒歩\t\t0
Takadanobaba\tMBF1303\tMichael Hogan\t8068985461\tmhogan4891@gmail.com\t1984/10/22\t男性\tアメリカ\t3-32-4 #21 Toyotama-Kita, Nerima-Ku, Tokyo\t日本人の配偶者\t2028/10/03\t○\t○\t○\t2026/02/26\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥10,000–¥12,999\t徒歩\t\t0
Takadanobaba\tMBF1304\tIsabelle Erbar\t7094448447\tIsabelle.erbar@gmail.com\t2000/10/28\t女性\tドイツ\t〒123-0844 東京都足立区興野２丁目１２−11\tワーホリ\t2027/01/31\t○\t○\t○\t2026/02/27\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥10,000–¥12,999\t徒歩\t\t0
Takadanobaba\tMBF1305\tBOUDADI Wissame \t070 4497 7753\twissame.b34@gmail.com\t2005/04/22\t女性\tフランス\t25-1, Miyasaka 1-Chōme Setagaya, Tokyo Japan 156-0051\tワーホリ\t2027/01/31\t○\t○\t○\t2026/02/27\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥10,000–¥12,999\t徒歩\t\t0
Takadanobaba\tMBF1306\tCollin James Yoshida\t080 6433 4438 \tYoshida.c88@gmail.com\t1988/11/06\t男性\tカナダ\t511-2 前田町戸塚区横浜市 前田ハイツ1-123\t日本人の配偶者\t2026/12/08\t○\t○\t○\t2026/02/27\t\t\t振込\tゆうちょ銀行\t０９８\t普通\t１３９２０１４\tヨシダ　コリン　ジェームズ\tﾖｼﾀﾞ ｺﾘﾝ ｼﾞｪｰﾑｽﾞ\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t0
Takadanobaba\tMBF1307\tTheodore Fu\t81 80 9194 0918\tteddy.agentt@gmail.com\t2000/12/09\t男性\tカナダ\t3 Kaitaichō, Shinjuku City, Tokyo 162-0802, Japan\tワーホリ\t2026/10/24\t○\t○\t○\t2026/03/02\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥10,000–¥12,999\t徒歩\t\t0
Takadanobaba\tMBF1308\tTate Suzuki\t7064501515\tokonma91@gmail.com\t2004/03/10\t男性\t日本人\t1-159 Koyasudori Kanagawa-ku Yokohama-shi Kanagawa-ken 221-0021\t日本人\t\t○\t○\t○\t2026/03/02\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t0
Takadanobaba\tMBF1309\tTatiana Antonella Pereira Vergara\t07092286213\ttatianapereiravergara@gmail.com\t1995/12/26\t女性\tチリ\t8-11-15 Nishigotanda, Shinagawa-ku, Tokyo - Room 1118\tワーホリ\t2027/07/26\t○\t○\t○\t2026/03/02\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t
Takadanobaba\tMBF1310\tQasem faroq salah faroq\t7090443083\tFaroqsalah2021@gmail.com\t2001/11/13\t男性\tイエメン\t4-chōme-20 Kishiya, Tsurumi Ward, Yokohama, Kanagawa 230-0078\t特定活動\t\t○\t\t○\t2026/3/2\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t0
Takadanobaba\tMBF1311\tNicolas Coronado\t070-9213-5419\tnicolas.icoronado@gmail.com\t1996/13/9\t男性\tチリ\t東京都 品川区 西五反田8-11-15\tワーホリ\t\t\t\t\t\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t
Takadanobaba\tMBF1312\tBuster Olsen\t070-9447-4796\tbauster98@gmail.com\t1998/11/3\t男性\tデンマーク\t\tワーホリ\t\t\t\t\t\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t
Takadanobaba\tMBF1313\tMagnus Flatau\t070-9452-6742\tmagnusflatau@gmail.com\t2005/3/21\t男性\tデンマーク\t\tワーホリ\t\t\t\t\t\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\tC\t\t2\t2\t2000\t2500\t¥8,000–¥9,999\t徒歩\t\t
Takadanobaba\tMBF1314\tConnor Alexander Minto \t8080684470\tcaminto94@gmail.com\t1994/06/26\t男性\tイギリス\t4 Chome-16-10 Ikebukuro, Toshima City, Tokyo 171-0014\tワーホリ\t2026/12/14\t○\t\t○\t2026/03/03\t\t\t現金\t\t\t\t\t\t\t\t\t\t\tRegular\t2.00\t2.75\t3.25\t4.50\t5.75\t7.00\t1000\t\t\t2\t2\t2000\t2500\t¥10,000–¥12,999\t徒歩\t\t0
Takadanobaba\tMBF1315\tAlberto Ramos\t\talberto.rramos17@gmail.com\t2003/05/15\t男性\tスペイン\t\tワーホリ\t\t○\t○\t○\t2026/03/04\t\t\t現金\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t
Takadanobaba\tMBF1316\tLowie V. Baybay\t\tlowieyamamoto@gmail.com\t1995/09/19\t男性\tフィリピン\t\t日本人の配偶者\t\t○\t○\t○\t2026/03/04\t\t\t現金\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t
Takadanobaba\tMBF1317\tDanae Espinoza Lemus\t\tdanaecarolina.e@gmail.com\t1999/03/29\t女性\tチリ\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t
Takadanobaba\tMBF1318\tMarc Lopez\t\tlpezmarc@gmail.com\t1998/02/26\t男性\tスペイン\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t
Takadanobaba\tMBF1319\tFrancisco Javier Romero Pardo\t\tFrancisco Javier Romero Pardo\t1998/12/03\t男性\tスペイン\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t`;

// ── ヘッダー定義 ──
const HEADERS = [
  'branch', 'staffId', 'name', 'phone', 'email', 'birthday', 'gender', 'country',
  'address', 'visa', 'visaExpiry', 'personalInfo', 'contract', 'residenceCard',
  'joinDate', 'leaveDate', 'leaveReason', 'paymentMethod', 'bank', 'bankBranch',
  'accountType', 'accountNumber', 'accountName', 'accountNameKana', 'transferNumber',
  'battery', 'bag', 'mobile', 'flyerDelivery', 'ratePlan',
  'rate1', 'rate2', 'rate3', 'rate4', 'rate5', 'rate6',
  'transportationFee', 'rank', 'attendanceCount', 'minTypes', 'maxTypes',
  'minSheets', 'maxSheets', 'targetAmount', 'transportationMethod', 'note', 'trainingAllowance'
];

// ── 国名マッピング ──
const COUNTRY_MAP: Record<string, string> = {
  'メキシコ': 'メキシコ', 'イギリス': 'イギリス', 'スパイン': 'スペイン', 'スペイン': 'スペイン',
  'フランス': 'フランス', 'チリ': 'チリ', 'カナダ': 'カナダ', 'アメリカ': 'アメリカ',
  'ブラジル': 'ブラジル', 'インド': 'インド', 'オランダ': 'オランダ', '日本': '日本', '日本人': '日本',
  'ミャンマー': 'ミャンマー', '韓国': '韓国', 'デンマーク': 'デンマーク', 'ドイツ': 'ドイツ',
  'フィリピン': 'フィリピン', 'イエメン': 'イエメン',
};

// ── ビザ名マッピング ──
const VISA_MAP: Record<string, string> = {
  '永住者': '永住者', 'ワーホリ': 'ワーキングホリデー', '定住者': '定住者',
  '日本人の配偶者': '日本人の配偶者等', '永住者の配偶者': '永住者の配偶者等',
  '日本人': '日本人（在留資格なし）', '特定活動': '特定活動',
};

function parseDate(val: string): Date | null {
  if (!val) return null;
  const v = val.trim();
  // 1996/13/9 のような不正日付を検出
  const parts = v.split('/');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) {
      console.warn(`  ⚠ 不正な日付: ${v} → スキップ`);
      return null;
    }
    return new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+09:00`);
  }
  return null;
}

function normalizePhone(val: string): string {
  if (!val) return '';
  // スペース、ハイフン除去
  let p = val.replace(/[\s\-]/g, '');
  // 81始まりで10桁以上 → 0始まりに変換
  if (p.startsWith('81') && p.length >= 11) {
    p = '0' + p.slice(2);
  }
  // メールアドレスが間違ってphoneに入っているケースをチェック
  if (p.includes('@') || p.includes('.com') || p.includes('.jp')) return '';
  return p;
}

function generatePasswordHash(birthday: Date | null): string {
  if (!birthday) {
    // 誕生日なしの場合はデフォルトパスワード
    return crypto.createHash('sha256').update('00000000').digest('hex');
  }
  const y = birthday.getFullYear();
  const m = String(birthday.getMonth() + 1).padStart(2, '0');
  const d = String(birthday.getDate()).padStart(2, '0');
  return crypto.createHash('sha256').update(`${y}${m}${d}`).digest('hex');
}

async function main() {
  console.log('=== 配布員マスタ インポート開始 ===\n');

  // 支店・国籍・ビザマスタを取得
  const branches = await prisma.branch.findMany();
  const countries = await prisma.country.findMany();
  const visaTypes = await prisma.visaType.findMany();

  // 既存の配布員を全取得
  const existingDistributors = await prisma.flyerDistributor.findMany({
    select: { id: true, staffId: true, name: true }
  });
  const existingByStaffId = new Map(existingDistributors.map(d => [d.staffId, d]));
  const existingByName = new Map(existingDistributors.map(d => [d.name.trim(), d]));

  // 支店マッピング
  const branchMap = new Map<string, number>();
  branches.forEach(b => {
    branchMap.set(b.nameEn, b.id);
    branchMap.set(b.nameJa, b.id);
  });

  // 国マッピング
  const countryMap = new Map<string, number>();
  countries.forEach(c => {
    countryMap.set(c.name, c.id);
    if (c.nameEn) countryMap.set(c.nameEn, c.id);
  });

  // ビザマッピング
  const visaMap = new Map<string, number>();
  visaTypes.forEach(v => {
    visaMap.set(v.name, v.id);
  });

  const lines = RAW_DATA.split('\n').filter(l => l.trim());
  let created = 0, skipped = 0, updated = 0, errors = 0;

  for (const line of lines) {
    const values = line.split('\t');
    const row: Record<string, string> = {};
    HEADERS.forEach((h, i) => {
      row[h] = (values[i] || '').trim();
    });

    const staffId = row.staffId;
    const name = row.name.trim();

    if (!staffId || !name) {
      console.log(`⚠ staffId or name missing → skip`);
      errors++;
      continue;
    }

    // 1. staffId が既存 → スキップ
    if (existingByStaffId.has(staffId)) {
      console.log(`SKIP (existing staffId): ${staffId} ${name}`);
      skipped++;
      continue;
    }

    // 2. 名前が一致するが staffId が違う → staffId を更新
    const nameMatch = existingByName.get(name);
    if (nameMatch && nameMatch.staffId !== staffId) {
      console.log(`UPDATE staffId: "${name}" ${nameMatch.staffId} → ${staffId}`);
      await prisma.flyerDistributor.update({
        where: { id: nameMatch.id },
        data: { staffId }
      });
      updated++;
      continue;
    }

    // 3. 新規作成
    const branchId = branchMap.get(row.branch) || null;
    const countryName = COUNTRY_MAP[row.country] || row.country;
    const countryId = countryMap.get(countryName) || null;
    const visaName = VISA_MAP[row.visa] || row.visa;
    const visaId = visaName ? (visaMap.get(visaName) || null) : null;

    const birthday = parseDate(row.birthday);
    const joinDate = parseDate(row.joinDate);
    const leaveDate = parseDate(row.leaveDate);
    const visaExpiry = parseDate(row.visaExpiry);

    // MBF1274: emailフィールドに住所が入っている（1-26-8 Narimasu）
    const email = row.email && row.email.includes('@') ? row.email : null;
    const phone = normalizePhone(row.phone);

    const gender = row.gender === '男性' ? 'male' : row.gender === '女性' ? 'female' : null;

    const data: any = {
      staffId,
      name,
      branchId,
      countryId,
      visaTypeId: visaId,
      phone: phone || null,
      email,
      birthday,
      gender,
      address: row.address || null,
      visaExpiryDate: visaExpiry,
      hasAgreedPersonalInfo: row.personalInfo === '○',
      hasSignedContract: row.contract === '○',
      hasResidenceCard: row.residenceCard === '○',
      joinDate,
      leaveDate,
      leaveReason: row.leaveReason || null,
      paymentMethod: row.paymentMethod || null,
      bankName: row.bank || null,
      bankBranchCode: row.bankBranch || null,
      bankAccountType: row.accountType || null,
      bankAccountNumber: row.accountNumber || null,
      bankAccountName: row.accountName || null,
      bankAccountNameKana: row.accountNameKana || null,
      transferNumber: row.transferNumber || null,
      equipmentBattery: row.battery || null,
      equipmentBag: row.bag || null,
      equipmentMobile: row.mobile || null,
      flyerDeliveryMethod: row.flyerDelivery || null,
      transportationMethod: row.transportationMethod || null,
      ratePlan: row.ratePlan || null,
      rate1Type: row.rate1 ? parseFloat(row.rate1) : null,
      rate2Type: row.rate2 ? parseFloat(row.rate2) : null,
      rate3Type: row.rate3 ? parseFloat(row.rate3) : null,
      rate4Type: row.rate4 ? parseFloat(row.rate4) : null,
      rate5Type: row.rate5 ? parseFloat(row.rate5) : null,
      rate6Type: row.rate6 ? parseFloat(row.rate6) : null,
      transportationFee: row.transportationFee || null,
      trainingAllowance: row.trainingAllowance || null,
      rank: row.rank || null,
      attendanceCount: row.attendanceCount ? parseInt(row.attendanceCount) : 0,
      minTypes: row.minTypes ? parseInt(row.minTypes) : null,
      maxTypes: row.maxTypes ? parseInt(row.maxTypes) : null,
      minSheets: row.minSheets ? parseInt(row.minSheets) : null,
      maxSheets: row.maxSheets ? parseInt(row.maxSheets) : null,
      targetAmount: row.targetAmount || null,
      note: row.note || null,
      passwordHash: generatePasswordHash(birthday),
      language: 'en',
    };

    try {
      await prisma.flyerDistributor.create({ data });
      console.log(`CREATE: ${staffId} ${name}`);
      created++;
    } catch (err: any) {
      console.error(`ERROR creating ${staffId} ${name}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n=== 完了 ===`);
  console.log(`新規作成: ${created}`);
  console.log(`スキップ(既存staffId): ${skipped}`);
  console.log(`staffId更新: ${updated}`);
  console.log(`エラー: ${errors}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
