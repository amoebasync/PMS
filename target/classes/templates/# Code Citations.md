# Code Citations

## License: unknown
https://github.com/zhi-lu/springCloudParent/blob/1f28d21028d27e3a5e0e1b282827d0de3f14f9a8/trend-trading-backtest-view/target/classes/templates/fore/view.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/muhammadsuhaib/Kawai-Management-System/blob/cb0cbc19c9a7bd0c9ef57a3922b93199fde7b8a9/masterJY2.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/zhi-lu/springCloudParent/blob/1f28d21028d27e3a5e0e1b282827d0de3f14f9a8/trend-trading-backtest-view/target/classes/templates/fore/view.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/muhammadsuhaib/Kawai-Management-System/blob/cb0cbc19c9a7bd0c9ef57a3922b93199fde7b8a9/masterJY2.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/zhi-lu/springCloudParent/blob/1f28d21028d27e3a5e0e1b282827d0de3f14f9a8/trend-trading-backtest-view/target/classes/templates/fore/view.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/muhammadsuhaib/Kawai-Management-System/blob/cb0cbc19c9a7bd0c9ef57a3922b93199fde7b8a9/masterJY2.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/zhi-lu/springCloudParent/blob/1f28d21028d27e3a5e0e1b282827d0de3f14f9a8/trend-trading-backtest-view/target/classes/templates/fore/view.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/muhammadsuhaib/Kawai-Management-System/blob/cb0cbc19c9a7bd0c9ef57a3922b93199fde7b8a9/masterJY2.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/zhi-lu/springCloudParent/blob/1f28d21028d27e3a5e0e1b282827d0de3f14f9a8/trend-trading-backtest-view/target/classes/templates/fore/view.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/muhammadsuhaib/Kawai-Management-System/blob/cb0cbc19c9a7bd0c9ef57a3922b93199fde7b8a9/masterJY2.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/zhi-lu/springCloudParent/blob/1f28d21028d27e3a5e0e1b282827d0de3f14f9a8/trend-trading-backtest-view/target/classes/templates/fore/view.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/muhammadsuhaib/Kawai-Management-System/blob/cb0cbc19c9a7bd0c9ef57a3922b93199fde7b8a9/masterJY2.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/zhi-lu/springCloudParent/blob/1f28d21028d27e3a5e0e1b282827d0de3f14f9a8/trend-trading-backtest-view/target/classes/templates/fore/view.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/muhammadsuhaib/Kawai-Management-System/blob/cb0cbc19c9a7bd0c9ef57a3922b93199fde7b8a9/masterJY2.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/zhi-lu/springCloudParent/blob/1f28d21028d27e3a5e0e1b282827d0de3f14f9a8/trend-trading-backtest-view/target/classes/templates/fore/view.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```


## License: unknown
https://github.com/muhammadsuhaib/Kawai-Management-System/blob/cb0cbc19c9a7bd0c9ef57a3922b93199fde7b8a9/masterJY2.html

```
Now I'll create an improved version with better spacing, clearer section separation, and enhanced guide visibility.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{layout :: mainLayout(${customer.id == null} ? '顧客新規登録' : '顧客情報編集', ~{::section})}">
<head>
    <style>
        /* フォーム要素のスタイル */
        .form-label { 
            font-weight: 700; 
            font-size: 0.9rem; 
            color: #1e293b; 
            margin-bottom: 0.6rem; 
            display: block;
        }
        
        .form-control, .form-select { 
            border-color: #cbd5e1; 
            padding: 0.7rem 0.95rem; 
            border-radius: 8px; 
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .form-control:focus, .form-select:focus { 
            border-color: #3b82f6; 
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* セクション全体 */
        .form-section { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 2.5rem; 
            margin-bottom: 2.5rem;
            border: 1px solid #e2e8f0; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: box-shadow 0.2s ease;
        }
        
        .form-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* セクションヘッダー */
        .section-header { 
            display: flex; 
            align-items: center; 
            margin-bottom: 2rem; 
            padding-bottom: 1.2rem; 
            border-bottom: 2px solid #e2e8f0; 
        }
        
        .section-icon {
            width: 42px; 
            height: 42px; 
            background: linear-gradient(135deg, #dbeafe, #eff6ff);
            color: #2563eb;
            border-radius: 10px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 14px; 
            font-size: 1.3rem;
        }
        
        .section-title { 
            font-size: 1.25rem; 
            font-weight: 800; 
            color: #0f172a; 
            margin: 0; 
            letter-spacing: -0.5px;
        }

        /* ガイドカード */
        .guide-card { 
            border: none; 
            border-radius: 12px; 
            background: #ffffff; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 2px solid #dbeafe;
        }
        
        .guide-card:hover {
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .guide-header { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            color: white; 
            padding: 1.8rem; 
            text-align: center;
        }
        
        .guide-header h6 {
            font-size: 1.1rem;
            letter-spacing: 0.3px;
        }
        
        .guide-body { 
            padding: 2rem; 
            background: linear-gradient(to bottom, rgba(59, 130, 246, 0.02), transparent);
        }
        
        .guide-item { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 1.8rem; 
            font-size: 0.9rem; 
            color: #475569; 
            line-height: 1.8;
            padding: 0.8rem;
            background: #f8fafc;
            border-left: 3px solid #3b82f6;
            border-radius: 6px;
        }
        
        .guide-item:last-of-type {
            margin-bottom: 0;
        }
        
        .guide-item i { 
            color: #3b82f6; 
            font-size: 1.2rem; 
            margin-top: 2px;
            flex-shrink: 0;
        }
        
        .guide-item strong {
            color: #1e293b;
        }

        /* 入力グループ */
        .input-group-text { 
            background-color: #f8fafc; 
            border-color: #cbd5e1; 
            color: #64748b;
            border-radius: 8px 0 0 8px;
        }

        /* バリデーション */
        .invalid-feedback { 
            display: block;
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.4rem;
            font-weight: 500;
        }

        /* エラーアラート */
        .alert-danger {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #7f1d1d;
            border-radius: 10px;
            margin-bottom: 2rem;
            padding: 1rem 1.2rem;
            font-weight: 500;
        }

        /* ボタン */
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        /* レスポンシブ調整 */
        @media (max-width: 992px) {
            .guide-card {
                margin-top: 2rem;
            }
            
            .sticky-top {
                position: static !important;
            }
        }

        /* フォーム行の改行調整 */
        .row.g-4 {
            row-gap: 1.5rem;
        }
    </style>
</head>
<body>
<section>
    <div class="mb-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-2" style="font-size: 0.85rem;">
                <li class="breadcrumb-item">
                    <a th:href="@{/customers}" class="text-decoration-none text-primary">顧客マスタ</a>
                </li>
                <li class="breadcrumb-item active" th:text="${customer.id == null} ? '新規登録' : '編集'"></li>
            </ol>
        </nav>
        <h2 class="fw-bold m-0" th:text="${customer.id == null} ? '新規顧客の登録' : '顧客情報の編集'" style="font-size: 1.8rem; color: #0f172a;"></h2>
    </div>

    <form th:action="@{/customers/save}" th:object="${customer}" method="post" novalidate>
        <input type="hidden" th:field="*{id}">
        <input type="hidden" th:field="*{customerCode}">

        <!-- エラーサマリー -->
        <div class="alert alert-danger" th:if="${#fields.hasAnyErrors()}">
            <i class="bi bi-exclamation-circle me-2"></i>入力内容に不備があります。赤枠の項目をご確認ください。
        </div>

        <div class="row g-4">
            <div class="col-lg-9">

                <!-- 基本情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                        <h5 class="section-title">基本情報</h5>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">顧客コード</label>
                            <input type="text"
                                   class="form-control bg-light fw-bold text-center"
                                   th:value="${customer.customerCode ?: '自動採番'}" 
                                   readonly>
                        </div>

                        <div class="col-md-5">
                            <label class="form-label">
                                顧客名（社名・屋号）
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{name}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('name')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="株式会社ティラミス">
                            <div class="invalid-feedback" th:errors="*{name}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                担当営業
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <select th:field="*{salesRepId}"
                                    class="form-select"
                                    th:classappend="${#fields.hasErrors('salesRepId')} ? 'is-invalid' : ''"
                                    required>
                                <option value="">担当者を選択してください...</option>
                                <option th:each="emp : ${employees}"
                                        th:value="${emp.id}"
                                        th:text="${emp.lastNameJa + ' ' + emp.firstNameJa}">
                                </option>
                            </select>
                            <div class="invalid-feedback" th:errors="*{salesRepId}"></div>
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-8">
                            <label class="form-label">
                                顧客名カナ
                                <span class="text-danger ms-1">*</span>
                            </label>
                            <input type="text"
                                   th:field="*{nameKana}"
                                   class="form-control"
                                   th:classappend="${#fields.hasErrors('nameKana')} ? 'is-invalid' : ''"
                                   required 
                                   placeholder="カブシキガイシャティラミス">
                            <div class="invalid-feedback" th:errors="*{nameKana}"></div>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">ステータス</label>
                            <select th:field="*{status}" class="form-select">
                                <option th:each="s : ${T(com.example.pms.Customer.Status).values()}"
                                        th:value="${s}"
                                        th:text="${s}">
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 連絡先情報セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-geo-alt-fill"></i></div>
                        <h5 class="section-title">連絡先情報</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-3">
                            <label class="form-label">郵便番号</label>
                            <input type="text" 
                                   th:field="*{postalCode}" 
                                   class="form-control" 
                                   placeholder="123-4567">
                        </div>
                        <div class="col-md-9">
                            <label class="form-label">住所</label>
                            <input type="text" 
                                   th:field="*{address}" 
                                   class="form-control" 
                                   placeholder="都道府県から入力してください">
                        </div>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">代表電話番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                <input type="text" 
                                       th:field="*{phone}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">FAX番号</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-printer"></i></span>
                                <input type="text" 
                                       th:field="*{fax}" 
                                       class="form-control" 
                                       placeholder="03-0000-0000">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 請求・インボイス設定セクション -->
                <div class="form-section">
                    <div class="section-header">
                        <div class="section-icon"><i class="bi bi-receipt-cutoff"></i></div>
                        <h5 class="section-title">請求・インボイス設定</h5>
                    </div>
                    
                    <div class="row g-4">
                        <div class="col-md-6">
                            <label class="form-label">適格請求書登録番号</label>
                            <div class="input-group">
                                <span class="input-group-text fw-bold">T</span>
                                <input type="text"
                                       th:field="*{invoiceRegistrationNumber}"
                                       class="form-control"
                                       placeholder="1234567890123"
                                       maxlength="13">
                            </div>
                            <div class="form-text" style="margin-top: 0.6rem;">T以降の13桁を入力してください（例: 1234567890123）</div>
                        </div>

                        <div class="col-md-2">
                            <label class="form-label">締日</label>
                            <select th:field="*{billingCutoffDay}" class="form-select">
                                <option value="">選択</option>
                                <option value="5">5日</option>
                                <option value="10">10日</option>
                                <option value="15">15日</option>
                                <option value="20">20日</option>
                                <option value="25">25日</option>
                                <option value="99">末
```

