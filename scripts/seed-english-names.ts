/**
 * Seed English names for prefectures and major cities
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const prefectureEnglishNames: Record<string, string> = {
  '北海道': 'Hokkaido',
  '青森県': 'Aomori',
  '岩手県': 'Iwate',
  '宮城県': 'Miyagi',
  '秋田県': 'Akita',
  '山形県': 'Yamagata',
  '福島県': 'Fukushima',
  '茨城県': 'Ibaraki',
  '栃木県': 'Tochigi',
  '群馬県': 'Gunma',
  '埼玉県': 'Saitama',
  '千葉県': 'Chiba',
  '東京都': 'Tokyo',
  '神奈川県': 'Kanagawa',
  '新潟県': 'Niigata',
  '富山県': 'Toyama',
  '石川県': 'Ishikawa',
  '福井県': 'Fukui',
  '山梨県': 'Yamanashi',
  '長野県': 'Nagano',
  '岐阜県': 'Gifu',
  '静岡県': 'Shizuoka',
  '愛知県': 'Aichi',
  '三重県': 'Mie',
  '滋賀県': 'Shiga',
  '京都府': 'Kyoto',
  '大阪府': 'Osaka',
  '兵庫県': 'Hyogo',
  '奈良県': 'Nara',
  '和歌山県': 'Wakayama',
  '鳥取県': 'Tottori',
  '島根県': 'Shimane',
  '岡山県': 'Okayama',
  '広島県': 'Hiroshima',
  '山口県': 'Yamaguchi',
  '徳島県': 'Tokushima',
  '香川県': 'Kagawa',
  '愛媛県': 'Ehime',
  '高知県': 'Kochi',
  '福岡県': 'Fukuoka',
  '佐賀県': 'Saga',
  '長崎県': 'Nagasaki',
  '熊本県': 'Kumamoto',
  '大分県': 'Oita',
  '宮崎県': 'Miyazaki',
  '鹿児島県': 'Kagoshima',
  '沖縄県': 'Okinawa',
};

// Major Tokyo wards/cities (expand as needed)
const cityEnglishNames: Record<string, string> = {
  '千代田区': 'Chiyoda',
  '中央区': 'Chuo',
  '港区': 'Minato',
  '新宿区': 'Shinjuku',
  '文京区': 'Bunkyo',
  '台東区': 'Taito',
  '墨田区': 'Sumida',
  '江東区': 'Koto',
  '品川区': 'Shinagawa',
  '目黒区': 'Meguro',
  '大田区': 'Ota',
  '世田谷区': 'Setagaya',
  '渋谷区': 'Shibuya',
  '中野区': 'Nakano',
  '杉並区': 'Suginami',
  '豊島区': 'Toshima',
  '北区': 'Kita',
  '荒川区': 'Arakawa',
  '板橋区': 'Itabashi',
  '練馬区': 'Nerima',
  '足立区': 'Adachi',
  '葛飾区': 'Katsushika',
  '江戸川区': 'Edogawa',
  // Major cities
  '横浜市': 'Yokohama',
  '川崎市': 'Kawasaki',
  'さいたま市': 'Saitama',
  '千葉市': 'Chiba',
  '名古屋市': 'Nagoya',
  '大阪市': 'Osaka',
  '京都市': 'Kyoto',
  '神戸市': 'Kobe',
  '福岡市': 'Fukuoka',
  '札幌市': 'Sapporo',
  '仙台市': 'Sendai',
  '広島市': 'Hiroshima',
  '八王子市': 'Hachioji',
  '町田市': 'Machida',
  '府中市': 'Fuchu',
  '調布市': 'Chofu',
  '西東京市': 'Nishi-Tokyo',
  '武蔵野市': 'Musashino',
  '三鷹市': 'Mitaka',
  '立川市': 'Tachikawa',
  '国分寺市': 'Kokubunji',
  '小金井市': 'Koganei',
  '日野市': 'Hino',
  '多摩市': 'Tama',
  '稲城市': 'Inagi',
};

async function main() {
  console.log('Seeding English names...');

  // Update prefectures
  let prefCount = 0;
  for (const [name, nameEn] of Object.entries(prefectureEnglishNames)) {
    const result = await prisma.prefecture.updateMany({
      where: { name, name_en: null },
      data: { name_en: nameEn },
    });
    prefCount += result.count;
  }
  console.log(`Updated ${prefCount} prefectures with English names`);

  // Update cities
  let cityCount = 0;
  for (const [name, nameEn] of Object.entries(cityEnglishNames)) {
    const result = await prisma.city.updateMany({
      where: { name, name_en: null },
      data: { name_en: nameEn },
    });
    cityCount += result.count;
  }
  console.log(`Updated ${cityCount} cities with English names`);

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
