-- 配布員ダミーデータ（5名）
-- パスワードはすべて "Pass1234" のbcryptハッシュ

INSERT INTO `flyer_distributors` (
  `staff_id`, `name`, `phone`, `email`, `gender`, `birthday`,
  `postal_code`, `address`,
  `rate_plan`, `rate_1_type`, `rate_2_type`, `rate_3_type`,
  `rate_4_type`, `rate_5_type`, `rate_6_type`,
  `rank`, `join_date`,
  `is_password_temp`, `language`,
  `created_at`, `updated_at`
) VALUES
(
  'D001', '田中 太郎', '090-1234-5678', 'tanaka@example.com',
  '男性', '1990-05-15',
  '160-0023', '東京都新宿区西新宿1-1-1',
  'Regular', 3.5, 4.0, 4.5, 5.0, 5.5, 6.0,
  'A', '2023-04-01',
  TRUE, 'ja',
  NOW(), NOW()
),
(
  'D002', '鈴木 花子', '080-2345-6789', 'suzuki@example.com',
  '女性', '1995-08-22',
  '171-0022', '東京都豊島区南池袋2-3-4',
  'Basic', 3.0, 3.5, 4.0, 4.5, 5.0, 5.5,
  'B', '2023-07-01',
  TRUE, 'ja',
  NOW(), NOW()
),
(
  'D003', '李 俊明', '070-3456-7890', 'li@example.com',
  '男性', '1988-12-03',
  '169-0075', '東京都新宿区高田馬場3-2-1',
  'Advanced', 4.0, 4.5, 5.0, 5.5, 6.0, 6.5,
  'A', '2022-10-01',
  TRUE, 'ja',
  NOW(), NOW()
),
(
  'D004', '佐藤 美咲', '090-4567-8901', 'sato@example.com',
  '女性', '2000-03-18',
  '150-0001', '東京都渋谷区神宮前4-5-6',
  'Basic', 3.0, 3.5, 4.0, 4.5, 5.0, 5.5,
  'C', '2024-01-15',
  TRUE, 'ja',
  NOW(), NOW()
),
(
  'D005', '김 민준', '080-5678-9012', 'kim@example.com',
  '男性', '1993-07-09',
  '168-0063', '東京都杉並区和泉1-2-3',
  'Regular', 3.5, 4.0, 4.5, 5.0, 5.5, 6.0,
  'B', '2023-11-01',
  TRUE, 'ja',
  NOW(), NOW()
);
