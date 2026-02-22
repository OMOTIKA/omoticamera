"use client";

// UI_VER: TERMS_PAGE_V2_20260212

import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

export default function TermsPage() {
  const UI_VER = "TERMS_PAGE_V2_20260212";
  const router = useRouter();

  return (
    <main style={wrap}>
      <div style={stickyTop}>
        <div style={topInner}>
          <button onClick={() => router.back()} style={btnBack} aria-label="戻る">
            ← 戻る
          </button>

          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={brand}>どこでもオモチカメラ</div>
            <div style={sub}>ホスト利用規約・プライバシーポリシー（全文）</div>
          </div>

          {/* 左右バランス用のダミー（戻るボタンの幅と揃える） */}
          <div style={{ width: 84 }} />
        </div>
      </div>

      <div style={body}>
        {/* 目次 */}
        <div style={toc}>
          <a href="#host-terms" style={tocLink}>
            ホスト利用規約
          </a>
          <a href="#privacy" style={tocLink}>
            プライバシーポリシー
          </a>
        </div>

        {/* 規約 */}
        <section id="host-terms" style={card}>
          <h2 style={h2}>ホスト利用規約（全文）</h2>
          <pre style={pre}>{HOST_TERMS_TEXT}</pre>
        </section>

        {/* プライバシー */}
        <section id="privacy" style={card}>
          <h2 style={h2}>プライバシーポリシー（全文）</h2>
          <pre style={pre}>{PRIVACY_TEXT}</pre>
        </section>

        <Footer uiVer={UI_VER} showSupporters={false} />
      </div>
    </main>
  );
}

/* ---------------- styles ---------------- */
const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#fff",
  color: "#111",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};

const stickyTop: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  padding: 10,
};

const topInner: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const btnBack: React.CSSProperties = {
  width: 84,
  padding: "10px 10px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 13,
  color: "#111",
};

const brand: React.CSSProperties = { fontSize: 18, fontWeight: 900, lineHeight: 1.1 };
const sub: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: "#555", marginTop: 3 };

const body: React.CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 12 };

const toc: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 10,
};

const tocLink: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  fontSize: 13,
  textDecoration: "none",
  color: "#111",
};

const card: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
  marginBottom: 12,
};

const h2: React.CSSProperties = {
  margin: 0,
  marginBottom: 10,
  fontSize: 15,
  fontWeight: 900,
};

const pre: React.CSSProperties = {
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: 12,
  lineHeight: 1.55,
  color: "#111",
};

/* ---------------- texts ---------------- */

const HOST_TERMS_TEXT = `📜
ホスト利用規約（全文）

おもいでシェアカメラ　どこでもオモチカメラ

最終更新日：［実装日を記載］
運営者：オモチカデザイン（代表：坂井玲友）

第1条（適用および契約の成立）
本規約は、オモチカデザイン（以下「運営者」）が提供するアプリケーションサービス
「おもいでシェアカメラ　どこでもオモチカメラ」（以下「本サービス」）のホスト機能の利用条件を定めるものです。
ホスト登録を行い、本規約に同意した利用者と運営者との間に、本規約に基づく利用契約が成立します。
【根拠条文】民法第522条第1項（契約の成立）

第2条（用語の定義）
本規約における用語の定義は以下のとおりです。
ホスト：イベントを作成・管理する利用者
ゲスト：QRコード等によりイベント参加する利用者
投稿データ：本サービスにアップロードされた画像データ
イベント：共有アルバム単位の公開グループ

第3条（登録要件）
正確な情報で登録するものとします。
未成年者は法定代理人の同意を必要とします。
【根拠条文】民法第5条第1項（未成年者の法律行為）

第4条（サービス内容）
本サービスは、イベント単位の共有アルバム機能を提供します。
閲覧期間：イベント作成後15日間
投稿画像は削除されず、非公開処理により管理されます
AIによる不適切画像判定機能を含みます

第5条（料金および支払方法）
本サービスはイベント単位の買い切り型です。
支払方法は以下のいずれかとします。
App Store決済
Google Play決済
運営者公式ウェブサイト決済
運営者指定の決済方法
キャンペーンコードにより特典が適用される場合があります。
キャンペーンには適用条件・期限があります。
条件未達の場合は適用されません。
本サービスはデジタル提供サービスのため原則返金不可とします。
法令上返金義務が発生する場合を除きます。
領収書は各決済事業者の発行分を利用します。
【根拠条文】
民法第522条
特定商取引法第11条
景品表示法第5条

第6条（広告表示）
本サービスには広告が表示される場合があります。
【根拠条文】景品表示法第5条（不当表示の禁止）

第7条（著作権の帰属）
投稿データの著作権は創作者に帰属します。
【根拠条文】著作権法第17条第1項

第8条（運営者への利用許諾）
ホストは投稿データについて、運営者に対し以下の利用を無償で許諾します。
保存
表示
複製
公衆送信
サービス紹介目的での掲載
非独占的利用許諾とします。
【根拠条文】著作権法第21条・第23条・第27条

第9条（ホストによる再利用）
ホストは、イベント記録、告知、SNS掲載、広告目的で投稿データを利用できます。

第10条（肖像権・権利保証）
ホストは、投稿データに写る人物の掲載同意を取得済みであることを保証します。
【根拠条文】民法第709条（不法行為）

第11条（ダウンロード画像の制限）
ダウンロード画像の再配布および商用利用を禁止します。
【根拠条文】著作権法第21条（複製権）

第12条（AI判定）
AI判定は補助機能であり、適法性・完全性を保証するものではありません。

第13条（禁止事項）
以下を禁止します。
著作権侵害投稿
肖像権侵害投稿
違法画像
公序良俗違反
不正利用
キャンペーンコードの不正使用

第14条（投稿責任）
投稿内容の法的責任は投稿者が負います。

第15条（個人情報）
利用者情報はプライバシーポリシーに従い管理します。
【根拠条文】個人情報保護法第2条第1項

第16条（利用停止）
規約違反・違法行為・安全確保必要時は利用制限できます。

第17条（責任制限）
運営者は通常損害についてのみ責任を負います。
故意または重過失の場合を除きます。
【根拠条文】消費者契約法第8条

第18条（法人利用）
法人利用は事業者間契約とし、消費者契約法は適用されません。
【根拠条文】消費者契約法第2条第1項

第19条（国内利用限定）
本サービスは日本国内利用を対象とします。

第20条（規約変更）
合理的範囲で規約変更を行うことがあります。

第21条（準拠法・管轄）
本規約は日本法を準拠法とします。
紛争は東京地方裁判所を第一審の専属的合意管轄とします。
【根拠条文】民事訴訟法第3条の2
`;

const PRIVACY_TEXT = `🔐 プライバシーポリシー（全文）

おもいでシェアカメラ　どこでもオモチカメラ

最終更新日：2026年2月12日
運営者：オモチカデザイン
代表者：坂井玲友
連絡先：sakaia@omotikadesign.com

第1条（基本方針）
オモチカデザイン（以下「運営者」）は、
「おもいでシェアカメラ　どこでもオモチカメラ」（以下「本サービス」）における利用者情報について、個人情報の保護に関する法律その他関係法令を遵守し、適切に取り扱います。
【根拠条文】個人情報保護法第3条（基本理念）

第2条（個人情報の定義）
本ポリシーにおける個人情報とは、生存する個人に関する情報であって、氏名、画像、識別符号その他の記述等により特定の個人を識別できるものをいいます。
【根拠条文】個人情報保護法第2条第1項
※写真画像は内容により個人情報に該当します。

第3条（取得する情報）
運営者は以下の情報を取得します。
ニックネーム
投稿画像（写真データ）
イベント参加情報
利用ログ情報
端末情報（OS・アプリバージョン等）
問い合わせ内容
決済結果情報（ストアから通知される範囲）
※クレジットカード情報は運営者は取得しません。

第4条（取得方法）
情報は以下の方法で取得します。
利用者による入力
写真アップロード
アプリ利用時の自動取得
ストア決済通知
問い合わせフォーム

第5条（利用目的）
取得した情報は次の目的で利用します。
イベント共有アルバム機能の提供
写真共有および閲覧制御
QR参加管理
AIによる不適切画像判定
不正利用の防止
問い合わせ対応
サービス改善
障害対応
広告表示の最適化
規約違反対応
【根拠条文】個人情報保護法第17条第1項（利用目的の特定）

第6条（利用目的の範囲内利用）
個人情報は、利用目的の範囲内でのみ取り扱います。
【根拠条文】個人情報保護法第18条第1項

第7条（第三者提供）
運営者は、次の場合を除き個人情報を第三者に提供しません。
本人の同意がある場合
法令に基づく場合
人命・身体・財産保護のため必要な場合
決済事業者・クラウド事業者等の業務委託先
【根拠条文】個人情報保護法第27条第1項

第8条（委託先管理）
業務委託先に個人情報を取り扱わせる場合は、適切に監督します。
【根拠条文】個人情報保護法第25条

第9条（保存期間）
投稿データおよびイベント情報は、イベント作成後15日間閲覧可能状態で保存されます。
その後は非公開状態に移行します。
システムログは安全管理目的で必要期間保存します。

第10条（削除および非公開）
本サービスは誤操作防止のため、即時削除ではなく非公開処理を採用しています。

第11条（安全管理措置）
運営者は、個人情報の漏えい・滅失・毀損防止のため、合理的な安全管理措置を講じます。
【根拠条文】個人情報保護法第23条（安全管理措置義務）

第12条（サーバ所在地）
本サービスのデータは日本国内のサーバで管理されます。

第13条（未成年者の情報）
未成年者は保護者同意の上で利用してください。
【根拠条文】民法第5条第1項

第14条（広告について）
本サービスでは第三者広告配信を利用する場合があります。
広告事業者がCookie等を利用することがあります。

第15条（開示・訂正・利用停止）
本人からの請求があった場合、法令に基づき対応します。
【根拠条文】個人情報保護法
第32条（開示）
第33条（訂正）
第35条（利用停止）

第16条（問い合わせ窓口）
個人情報に関するお問い合わせ：
sakaia@omotikadesign.com

第17条（国内利用限定）
本サービスは日本国内利用を対象とします。

第18条（ポリシー変更）
法令変更・サービス変更に応じて改定する場合があります。
`;