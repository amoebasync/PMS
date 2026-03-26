import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding training questions...');

  // Check if already seeded
  const existingCount = await prisma.trainingQuestion.count();
  if (existingCount > 0) {
    console.log(`Already have ${existingCount} questions, skipping seed.`);
    // Still upsert system settings
    await upsertSystemSettings();
    return;
  }

  const questions = [
    // ─── Category 1: 日常業務手順 ───────────────────────────────────────────
    {
      sortOrder: 1,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa: '何時から何時の間に事務所に出社する必要がありますか？',
      questionEn: 'What time should you arrive at the office?',
      explanationJa:
        '7時から10時の間に事務所に出社してください。10時以降になる場合はLINEで連絡してください。',
      explanationEn:
        'You should come to the office between 7am and 10am. If you will be later than 10am, contact by LINE.',
      choices: [
        { sortOrder: 1, choiceTextJa: '6時〜9時', choiceTextEn: '6am-9am', isCorrect: false },
        { sortOrder: 2, choiceTextJa: '7時〜10時', choiceTextEn: '7am-10am', isCorrect: true },
        { sortOrder: 3, choiceTextJa: '8時〜11時', choiceTextEn: '8am-11am', isCorrect: false },
        { sortOrder: 4, choiceTextJa: '9時〜12時', choiceTextEn: '9am-12pm', isCorrect: false },
      ],
    },
    {
      sortOrder: 2,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa: '配布を開始する前に必ずやるべきことは何ですか？',
      questionEn: 'What must you do before starting distribution?',
      explanationJa:
        '配布開始時は必ず①LINEでチラシと紙地図の写真を送信、②会社の携帯電話でアプリから配布開始を報告してください。',
      explanationEn:
        'Before starting, you must: 1) Send photos of flyers and paper map by LINE, 2) Report the start of distribution using the company phone app.',
      choices: [
        {
          sortOrder: 1,
          choiceTextJa: 'チラシの枚数を自分で決める',
          choiceTextEn: 'Decide the number of flyers yourself',
          isCorrect: false,
        },
        {
          sortOrder: 2,
          choiceTextJa:
            'LINEでチラシと地図の写真を送信し、会社電話でアプリから開始報告する',
          choiceTextEn:
            'Send photos of flyers and map by LINE, and report start via company phone',
          isCorrect: true,
        },
        {
          sortOrder: 3,
          choiceTextJa: '事務所に電話する',
          choiceTextEn: 'Call the office',
          isCorrect: false,
        },
        {
          sortOrder: 4,
          choiceTextJa: '何もしなくてよい',
          choiceTextEn: 'Nothing required',
          isCorrect: false,
        },
      ],
    },
    {
      sortOrder: 3,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa: '配布は何時までに終了しなければなりませんか？',
      questionEn: 'By what time must you finish distribution?',
      explanationJa: '配布は午後11時（23時）までに終了してください。',
      explanationEn: 'Please finish distribution before 11pm.',
      choices: [
        { sortOrder: 1, choiceTextJa: '午後5時', choiceTextEn: '5pm', isCorrect: false },
        { sortOrder: 2, choiceTextJa: '午後8時', choiceTextEn: '8pm', isCorrect: false },
        { sortOrder: 3, choiceTextJa: '午後9時', choiceTextEn: '9pm', isCorrect: false },
        { sortOrder: 4, choiceTextJa: '午後11時', choiceTextEn: '11pm', isCorrect: true },
      ],
    },
    {
      sortOrder: 4,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa: '配布終了後にやるべきことに含まれないのは次のどれですか？',
      questionEn: 'Which of the following is NOT required after finishing distribution?',
      explanationJa:
        'チラシを捨てることは絶対に禁止です。不正行為に該当します。余ったチラシがある場合はLINEで連絡し、指示に従ってください。',
      explanationEn:
        'Disposing of flyers is strictly prohibited and is considered misconduct. If you have leftover flyers, contact by LINE and follow instructions.',
      choices: [
        {
          sortOrder: 1,
          choiceTextJa: 'LINEで紙地図の写真を送信する',
          choiceTextEn: 'Send a photo of the paper map by LINE',
          isCorrect: false,
        },
        {
          sortOrder: 2,
          choiceTextJa: '配布枚数を報告する',
          choiceTextEn: 'Report the number of distributed flyers',
          isCorrect: false,
        },
        {
          sortOrder: 3,
          choiceTextJa: '残りのチラシを捨てる',
          choiceTextEn: 'Throw away leftover flyers',
          isCorrect: true,
        },
        {
          sortOrder: 4,
          choiceTextJa: '余ったチラシについてLINEで連絡する',
          choiceTextEn: 'Contact by LINE about leftover flyers',
          isCorrect: false,
        },
      ],
    },

    // ─── Category 2: 報酬体系 ────────────────────────────────────────────────
    {
      sortOrder: 5,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa: '報酬はどのように計算されますか？',
      questionEn: 'How is your payment calculated?',
      explanationJa:
        '報酬はポスト数に基づく出来高制です。配布したポストの数が多いほど、報酬も多くなります。',
      explanationEn:
        'Payment is based on performance (piece-rate system). You are paid according to the number of mailboxes you deliver flyers to.',
      choices: [
        {
          sortOrder: 1,
          choiceTextJa: '時給制',
          choiceTextEn: 'Hourly rate',
          isCorrect: false,
        },
        {
          sortOrder: 2,
          choiceTextJa: '配布したポスト数に応じた出来高制',
          choiceTextEn: 'Piece-rate based on mailboxes',
          isCorrect: true,
        },
        {
          sortOrder: 3,
          choiceTextJa: '日給制',
          choiceTextEn: 'Daily rate',
          isCorrect: false,
        },
        {
          sortOrder: 4,
          choiceTextJa: '月給制',
          choiceTextEn: 'Monthly salary',
          isCorrect: false,
        },
      ],
    },
    {
      sortOrder: 6,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa: 'エリアランク「CCC」の場合、ポスト単価はいくら加算されますか？',
      questionEn: 'For area rank "CCC", how much is added to the rate per mailbox?',
      explanationJa:
        'エリアランクCCCの場合は+0.50円加算されます。配布地図の左側にエリア調整が記載されています。',
      explanationEn:
        'Area rank CCC adds +0.50 yen per mailbox. You can find the area adjustment on the left side of the distribution map.',
      choices: [
        { sortOrder: 1, choiceTextJa: '+0円', choiceTextEn: '+0 yen', isCorrect: false },
        { sortOrder: 2, choiceTextJa: '+0.25円', choiceTextEn: '+0.25 yen', isCorrect: false },
        { sortOrder: 3, choiceTextJa: '+0.50円', choiceTextEn: '+0.50 yen', isCorrect: true },
        { sortOrder: 4, choiceTextJa: '+1.25円', choiceTextEn: '+1.25 yen', isCorrect: false },
      ],
    },
    {
      sortOrder: 7,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa: '昇給の条件として正しくないものはどれですか？',
      questionEn: 'Which is NOT a condition for a pay raise?',
      explanationJa:
        '昇給条件は①残りなく完配、②手順遵守、③禁止物件に配布しない、④ミスが少ない、の4つです。毎日出勤することは条件に含まれません（自由シフト制のため）。',
      explanationEn:
        'Pay raise conditions are: complete distribution with few leftovers, follow procedures, not deliver to prohibited locations, and make few mistakes. Daily attendance is not required since it\'s a free-shift job.',
      choices: [
        {
          sortOrder: 1,
          choiceTextJa: '残りなく配布を完了する',
          choiceTextEn: 'Complete distribution with no leftovers',
          isCorrect: false,
        },
        {
          sortOrder: 2,
          choiceTextJa: '配布ルールを守る',
          choiceTextEn: 'Follow distribution procedures',
          isCorrect: false,
        },
        {
          sortOrder: 3,
          choiceTextJa: '毎日出勤する',
          choiceTextEn: 'Come to work every day',
          isCorrect: true,
        },
        {
          sortOrder: 4,
          choiceTextJa: '禁止物件に配布しない',
          choiceTextEn: 'Not deliver to prohibited locations',
          isCorrect: false,
        },
      ],
    },

    // ─── Category 3: 報告・支払い ─────────────────────────────────────────────
    {
      sortOrder: 8,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa: 'シフト報告の締切はいつですか？',
      questionEn: 'When is the deadline for reporting your shift?',
      explanationJa:
        'シフトは毎週金曜日までにLINEメニューの「シフトを入力する」から報告してください。',
      explanationEn:
        'You must report your shift by the end of every Friday using the "Enter your shift" button in the LINE menu.',
      choices: [
        {
          sortOrder: 1,
          choiceTextJa: '毎週月曜日',
          choiceTextEn: 'Every Monday',
          isCorrect: false,
        },
        {
          sortOrder: 2,
          choiceTextJa: '毎週水曜日',
          choiceTextEn: 'Every Wednesday',
          isCorrect: false,
        },
        {
          sortOrder: 3,
          choiceTextJa: '毎週金曜日',
          choiceTextEn: 'Every Friday',
          isCorrect: true,
        },
        {
          sortOrder: 4,
          choiceTextJa: '毎週日曜日',
          choiceTextEn: 'Every Sunday',
          isCorrect: false,
        },
      ],
    },
    {
      sortOrder: 9,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa: '交通費申請の締切はいつですか？',
      questionEn: 'When is the deadline for reporting transportation fees?',
      explanationJa:
        '交通費は毎週火曜日までにLINEメニューの「請求する」から申請してください。作業を完了した場合のみ交通費が支給されます。',
      explanationEn:
        'Transportation fees must be reported by every Tuesday using the "Payment" button in the LINE menu. Fees are only reimbursed if you complete the work.',
      choices: [
        {
          sortOrder: 1,
          choiceTextJa: '毎週月曜日',
          choiceTextEn: 'Every Monday',
          isCorrect: false,
        },
        {
          sortOrder: 2,
          choiceTextJa: '毎週火曜日',
          choiceTextEn: 'Every Tuesday',
          isCorrect: true,
        },
        {
          sortOrder: 3,
          choiceTextJa: '毎週金曜日',
          choiceTextEn: 'Every Friday',
          isCorrect: false,
        },
        {
          sortOrder: 4,
          choiceTextJa: '毎月末',
          choiceTextEn: 'End of month',
          isCorrect: false,
        },
      ],
    },
    {
      sortOrder: 10,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa: '銀行振込の場合、振込手数料はいくらですか？',
      questionEn: 'How much is the bank transfer fee?',
      explanationJa:
        '振込の場合は250円の振込手数料が報酬から差し引かれます。手渡しの場合は手数料はかかりません。',
      explanationEn:
        'A bank transfer fee of 250 JPY will be deducted from the payment. Hand-cash payment has no fee.',
      choices: [
        { sortOrder: 1, choiceTextJa: '無料', choiceTextEn: 'Free', isCorrect: false },
        { sortOrder: 2, choiceTextJa: '150円', choiceTextEn: '150 yen', isCorrect: false },
        { sortOrder: 3, choiceTextJa: '250円', choiceTextEn: '250 yen', isCorrect: true },
        { sortOrder: 4, choiceTextJa: '500円', choiceTextEn: '500 yen', isCorrect: false },
      ],
    },

    // ─── Category 4: 配布ルール ───────────────────────────────────────────────
    {
      sortOrder: 11,
      type: 'TRUE_FALSE' as const,
      questionJa: '指定されたエリア外の建物にもチラシを配布してよい。',
      questionEn: 'You can deliver flyers to buildings outside the designated area.',
      explanationJa:
        '必ず指定されたエリア内の建物にのみ配布してください。エリア外への配布は禁止です。',
      explanationEn:
        'You must only distribute inside the designated area. Distributing outside the area is prohibited.',
      choices: [
        { sortOrder: 1, choiceTextJa: '正しい', choiceTextEn: 'True', isCorrect: false },
        { sortOrder: 2, choiceTextJa: '間違い', choiceTextEn: 'False', isCorrect: true },
      ],
    },
    {
      sortOrder: 12,
      type: 'TRUE_FALSE' as const,
      questionJa:
        '個別のポストに「チラシお断り」のステッカーが貼ってある場合、そのポストには配布しない。',
      questionEn:
        'If an individual mailbox has a "No Flyer" sticker, you should not deliver to that mailbox.',
      explanationJa:
        '個別ポストに「チラシお断り」等のステッカーがある場合は、そのポストへの配布は禁止です。',
      explanationEn: 'Individual mailboxes with "No Flyer" stickers must be skipped.',
      choices: [
        { sortOrder: 1, choiceTextJa: '正しい', choiceTextEn: 'True', isCorrect: true },
        { sortOrder: 2, choiceTextJa: '間違い', choiceTextEn: 'False', isCorrect: false },
      ],
    },
    {
      sortOrder: 13,
      type: 'TRUE_FALSE' as const,
      questionJa: '「管理室」と書かれたポストにもチラシを配布してよい。',
      questionEn: 'You can deliver flyers to a mailbox labeled "管理室" (Administrative Office).',
      explanationJa: '「管理室」または「管理組合」と表示されたポストへの配布は禁止です。',
      explanationEn:
        'Do not deliver flyers to mailboxes labeled "管理室" (Administrative Office) or "管理組合".',
      choices: [
        { sortOrder: 1, choiceTextJa: '正しい', choiceTextEn: 'True', isCorrect: false },
        { sortOrder: 2, choiceTextJa: '間違い', choiceTextEn: 'False', isCorrect: true },
      ],
    },
    {
      sortOrder: 14,
      type: 'TRUE_FALSE' as const,
      questionJa: 'ポストが満杯でもチラシを無理やり入れてよい。',
      questionEn: 'You can force flyers into a full mailbox.',
      explanationJa:
        '満杯のポストにチラシを入れてはいけません。チラシがはみ出すと濡れたり壊れたりする原因になります。',
      explanationEn:
        'Do not deliver flyers into full mailboxes. Flyers can get wet and destroyed if they are not completely inside the mailbox.',
      choices: [
        { sortOrder: 1, choiceTextJa: '正しい', choiceTextEn: 'True', isCorrect: false },
        { sortOrder: 2, choiceTextJa: '間違い', choiceTextEn: 'False', isCorrect: true },
      ],
    },
    {
      sortOrder: 15,
      type: 'TRUE_FALSE' as const,
      questionJa: '同じチラシを同じポストに複数枚入れてもよい。',
      questionEn: 'You can deliver multiple copies of the same flyer to the same mailbox.',
      explanationJa: '同じチラシを同じポストに複数入れることは禁止です。不正行為に該当します。',
      explanationEn:
        'Delivering multiple copies of the same flyer to one mailbox is prohibited and considered misconduct.',
      choices: [
        { sortOrder: 1, choiceTextJa: '正しい', choiceTextEn: 'True', isCorrect: false },
        { sortOrder: 2, choiceTextJa: '間違い', choiceTextEn: 'False', isCorrect: true },
      ],
    },
    {
      sortOrder: 16,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa:
        'マンションの共用部に「チラシ禁止 警察に通報します」という掲示があります。どうしますか？',
      questionEn:
        'An apartment building has a sign saying "No flyers, will call police". What should you do?',
      explanationJa:
        '「チラシ禁止」「警察に通報する」等の掲示があっても、チラシの配布は完全に合法です。配布を続けてください。ただし「罰金」「着払い・返送」「広告主」の記載がある場合はその建物をスキップしてください。',
      explanationEn:
        'Even if a sign says "No flyers" or "Will call police", flyer distribution is completely legal. Continue distributing. However, skip buildings with signs mentioning "罰金" (fines), "着払い・返送" (return), or "広告主" (advertiser).',
      choices: [
        {
          sortOrder: 1,
          choiceTextJa: 'その建物全体をスキップする',
          choiceTextEn: 'Skip the entire building',
          isCorrect: false,
        },
        {
          sortOrder: 2,
          choiceTextJa: '一部のポストにだけ配布する',
          choiceTextEn: 'Deliver to some mailboxes only',
          isCorrect: false,
        },
        {
          sortOrder: 3,
          choiceTextJa: '全てのポストに配布する',
          choiceTextEn: 'Deliver to all mailboxes',
          isCorrect: true,
        },
        {
          sortOrder: 4,
          choiceTextJa: '事務所に電話して確認する',
          choiceTextEn: 'Call the office to confirm',
          isCorrect: false,
        },
      ],
    },
    {
      sortOrder: 17,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa: 'マンションの掲示板に「罰金を請求します」と書かれています。どうしますか？',
      questionEn: 'An apartment bulletin board says "We will charge a fine". What should you do?',
      explanationJa:
        '「罰金」「着払い・返送」「広告主」の記載がある建物はスキップしてください。',
      explanationEn:
        'Skip buildings with signs mentioning "罰金" (fines), "着払い・返送" (return to sender), or "広告主" (advertiser).',
      choices: [
        {
          sortOrder: 1,
          choiceTextJa: '通常通り配布する',
          choiceTextEn: 'Distribute normally',
          isCorrect: false,
        },
        {
          sortOrder: 2,
          choiceTextJa: 'その建物をスキップする',
          choiceTextEn: 'Skip that building',
          isCorrect: true,
        },
        {
          sortOrder: 3,
          choiceTextJa: '1階のポストにだけ配布する',
          choiceTextEn: 'Only deliver to ground floor mailboxes',
          isCorrect: false,
        },
        {
          sortOrder: 4,
          choiceTextJa: '管理人に聞く',
          choiceTextEn: 'Ask the building manager',
          isCorrect: false,
        },
      ],
    },

    // ─── Category 5: 不正行為・コンプライアンス ──────────────────────────────
    {
      sortOrder: 18,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa: '以下のうち、不正行為に該当するのはどれですか？',
      questionEn: 'Which of the following is considered misconduct?',
      explanationJa:
        'チラシを意図的に廃棄することは不正行為です。その他の不正行為：同じチラシの重複配布、配布枚数の虚偽報告と未配布チラシの隠蔽。',
      explanationEn:
        'Intentionally disposing of flyers is misconduct. Other misconduct includes: distributing multiple of the same flyers, and falsifying reports while concealing undistributed flyers.',
      choices: [
        {
          sortOrder: 1,
          choiceTextJa: '休憩を取る',
          choiceTextEn: 'Taking a break',
          isCorrect: false,
        },
        {
          sortOrder: 2,
          choiceTextJa: 'チラシを意図的に捨てる',
          choiceTextEn: 'Intentionally disposing of flyers',
          isCorrect: true,
        },
        {
          sortOrder: 3,
          choiceTextJa: 'ゆっくりペースで配布する',
          choiceTextEn: 'Distributing at a slow pace',
          isCorrect: false,
        },
        {
          sortOrder: 4,
          choiceTextJa: '配布順序を変える',
          choiceTextEn: 'Changing the distribution order',
          isCorrect: false,
        },
      ],
    },
    {
      sortOrder: 19,
      type: 'MULTIPLE_CHOICE' as const,
      questionJa: '不正行為が発覚した場合、どのような結果になりますか？',
      questionEn: 'What can happen if misconduct is discovered?',
      explanationJa:
        '不正行為による損害が発生した場合、会社は損害賠償を請求する権利があります。政府関連のチラシの場合、ビザ取消の可能性もあります。品質は毎日スーパーバイザーによってチェックされています。',
      explanationEn:
        'The company may claim compensation for damages. For government-related flyers, visa cancellation is possible. Your work quality is checked by supervisors every day.',
      choices: [
        {
          sortOrder: 1,
          choiceTextJa: '口頭注意のみ',
          choiceTextEn: 'Verbal warning only',
          isCorrect: false,
        },
        {
          sortOrder: 2,
          choiceTextJa: '1日の給料カット',
          choiceTextEn: "One day's pay cut",
          isCorrect: false,
        },
        {
          sortOrder: 3,
          choiceTextJa: '損害賠償請求やビザ取消の可能性',
          choiceTextEn: 'Possible compensation claims and visa cancellation',
          isCorrect: true,
        },
        {
          sortOrder: 4,
          choiceTextJa: '特に何も起きない',
          choiceTextEn: 'Nothing happens',
          isCorrect: false,
        },
      ],
    },
    {
      sortOrder: 20,
      type: 'TRUE_FALSE' as const,
      questionJa: 'チラシはポストの奥までしっかり入れなければならない。',
      questionEn: 'You must push flyers all the way into the mailbox.',
      explanationJa:
        'チラシをポストの奥までしっかり入れてください。はみ出していると雨で濡れて破損する原因になります。',
      explanationEn:
        'Push flyers all the way into the mailbox. Flyers can get wet and destroyed if they are not completely inside.',
      choices: [
        { sortOrder: 1, choiceTextJa: '正しい', choiceTextEn: 'True', isCorrect: true },
        { sortOrder: 2, choiceTextJa: '間違い', choiceTextEn: 'False', isCorrect: false },
      ],
    },
  ];

  for (const q of questions) {
    await prisma.trainingQuestion.create({
      data: {
        type: q.type,
        questionJa: q.questionJa,
        questionEn: q.questionEn,
        explanationJa: q.explanationJa,
        explanationEn: q.explanationEn,
        isActive: true,
        sortOrder: q.sortOrder,
        choices: {
          create: q.choices,
        },
      },
    });
  }

  await upsertSystemSettings();

  console.log('Done! Seeded 20 training questions.');
}

async function upsertSystemSettings() {
  await prisma.systemSetting.upsert({
    where: { key: 'trainingTestQuestionCount' },
    update: {},
    create: { key: 'trainingTestQuestionCount', value: '10' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'trainingTestPassingRate' },
    update: {},
    create: { key: 'trainingTestPassingRate', value: '80' },
  });
  console.log('SystemSetting upserted: trainingTestQuestionCount=10, trainingTestPassingRate=80');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
