# Loop State

## 1. この文書の役割

この文書は、セッションをまたいでLoop Engineeringの現在状態を共有するための状態ファイルである。

この文書は、事業計画書本文、完成条件、詳細ログではない。作業再開時にOrchestrator、Triage、各エージェントが「今どこまで進んでいて、次に何をすべきか」を短時間で把握するために使う。

## 2. 読むタイミング

- セッション開始時。
- `daily_triage` 開始前。
- `pr_babysitter` 開始前。
- Status変更前。
- L2 / L3実行前。
- Human Queueから再開する時。
- コンテキスト利用率が高くなり、要約して継続する時。

## 3. 更新するタイミング

- セッション終了前。
- OrchestratorがLoop pattern、L分類、次アクションを採用した後。
- Human Queue、Blocked、PR Ready、Auto Committed、Doneへ移る時。
- `docs/loop-run.log.md` で速度低下または一時停止が必要になった時。
- Red / Blue / Purple Teamの運用確認結果が出た時。

更新主体はOrchestratorまたはKnowledge / Log Agentとする。Triage Agentは更新案を出せるが、原則として直接更新しない。

## 4. 現在状態

| 項目 | 内容 |
|---|---|
| project_goal | 駄菓子事業計画書初版を作成する |
| current_phase | #17 最終レビューL1完了 / 事業計画書初版Pass / 親Issue #1 completed |
| active_loop_patterns | `daily_triage`, `pr_babysitter` |
| current_branch | codex/issue-17-final-review-l1 |
| github_repo | `git@github.com:harukishimo/dagashi_jigyo.git` |
| current_control_stage | none |
| current_run_id | LOG-051 |
| last_decision_by | Human / Orchestrator |
| next_target | 上位ゴールは完了。#18はBP本文対象外のLoop運用Issueとして、必要時に別途扱う |
| resume_condition | PR #34はmainへmerge済み。Issue #16はcompleted close済み。Issue #17はPass判定でcompleted close済み。親Issue #1もcompleted close済み |
| resume_owner | Human / Orchestrator |
| last_updated | 2026-07-01 |
| updated_by | Orchestrator |

## 5. 重要な決定事項

| ID | 決定事項 | 根拠 | 更新日 |
|---|---|---|---|
| D-001 | 上位ゴールはLoop基盤整備ではなく、駄菓子事業計画書初版の作成である | `docs/projects.md`, `docs/intend.md` | 未記録 |
| D-002 | サブエージェント起動方式はB方式である | `agents/README.md`, `docs/loop.md` | 未記録 |
| D-003 | 現時点のLoop patternは `daily_triage` と `pr_babysitter` のみである | `docs/loop.md` | 未記録 |
| D-004 | L1はレポートのみ、L2はPR作成まで、L3はdenylist外のAuto-commitまでである | `docs/levels.md` | 未記録 |
| D-005 | denylist本体は `docs/denylist.json` を正とする | `docs/levels.md`, `docs/denylist.json` | 未記録 |
| D-006 | GitHub Issue #1〜#18は、事業計画書初版作成に必要な問い、入力、出力契約、Human Check、Integration Ready条件を持つ構造へ更新済み | GitHub Issue #1〜#18 | 2026-06-30 |
| D-007 | 2026-07-01のdaily_triageでは、#1〜#18はすべてopen、Issueコメントはなし、open PRはなし。次に対応可能なIssueは#2 前提台帳 | GitHub Issue #1〜#18, GitHub PR検索, `docs/dailytriage.md` | 2026-07-01 |
| D-008 | Humanが#2 前提台帳のL2開始を承認した | ユーザー発言「#2をL2で開始してOK」 | 2026-07-01 |
| D-009 | #2 前提台帳はR/B/P/Judgeレビューを通し、構造化素材としてIntegration Readyと判定した。ただしHuman Check未解消事項は残す | `docs/issue-02-prerequisite-ledger.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-010 | #2 前提台帳のPR #19を作成し、Issue #2に `status: pr-ready` と `integration-ready` を付与した | PR #19, GitHub Issue #2, `docs/loop-run.log.md` | 2026-07-01 |
| D-011 | PR #19がmergeされ、Issue #2はcompletedとしてcloseされた。Issue #2の状態labelは `status: done` に更新済み | PR #19, GitHub Issue #2 | 2026-07-01 |
| D-012 | Humanが#3 Why / 解決したい課題のL2開始とPR作成までを承認した | ユーザー発言「開始をしてもらって大丈夫です。PR作成まで許可無しで対応してもらって大丈夫」 | 2026-07-01 |
| D-013 | #3 Why素材はR/B/P/Judgeレビューを通し、BP-02/BP-13へ渡せる構造化素材としてIntegration Readyと判定した。ただし外部説明表現や課題表現はHuman Checkに残す | `docs/issue-03-why-problem.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-014 | #3 Why素材のPR #21を作成した。PR #21はPR #20のbranchをbaseにした積み上げPRで、Issue #3のlabel/comment/stateは未変更 | PR #21, `docs/issue-03-why-problem.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-015 | PR #21はPR #20のbranchへmerge済み。ただしPR #20はdraft openのため、#3素材はmain未反映で、Issue #3もopenのまま | PR #20, PR #21, GitHub Issue #3 | 2026-07-01 |
| D-016 | PR #20がmainへmergeされ、#3 Why素材はmain反映済み。Issue #3はopenのまま | PR #20, PR #21, GitHub Issue #3 | 2026-07-01 |
| D-017 | Issue #3をcompletedとしてcloseし、`integration-ready` と `status: done` を付与した | GitHub Issue #3 | 2026-07-01 |
| D-018 | #4 Who素材はR/B/P/Judgeレビューを通し、BP-04/BP-05/BP-13へ渡せる構造化素材としてIntegration Readyと判定した。ただし対象年齢、参加条件、施設承認、保護者同意、責任範囲はHuman Checkに残す | `docs/issue-04-stakeholders.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-019 | #4 Who素材のdraft PR #23を作成し、Issue #4に `integration-ready` と `status: pr-ready` を付与した。Issue #4はPR merge後までopenのままにする | PR #23, GitHub Issue #4 | 2026-07-01 |
| D-020 | PR #23がmainへmergeされ、Issue #4はcompletedとしてcloseされた。Issue #4の状態labelは `status: done` に更新済み | PR #23, GitHub Issue #4 | 2026-07-01 |
| D-021 | #5 What素材はR/B/P/Judgeレビューを通し、BP-05/BP-08/BP-13へ渡せる構造化素材としてIntegration Readyと判定した。ただし価値優先順位、外部説明表現、成功基準、子どもの記録方法はHuman Checkに残す | `docs/issue-05-value-experience.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-022 | #5 What素材のdraft PR #24を作成し、Issue #5に `integration-ready` と `status: pr-ready` を付与した。Issue #5はPR merge後までopenのままにする | PR #24, GitHub Issue #5 | 2026-07-01 |
| D-023 | PR #24がmainへmergeされ、Issue #5はcompletedとしてcloseされた。Issue #5の状態labelは `status: done` に更新済み | PR #24, GitHub Issue #5 | 2026-07-01 |
| D-024 | #6 How素材はR/B/P/Judgeレビューを通し、BP-06/BP-09/BP-10/BP-13へ渡せる構造化素材としてIntegration Readyと判定した。ただし実施場所、頻度、規模、施設承認、安全・衛生、責任範囲、現金管理はHuman Checkに残す | `docs/issue-06-implementation-model.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-025 | #6 How素材のdraft PR #25を作成し、Issue #6に `integration-ready` と `status: pr-ready` を付与した。Issue #6はPR merge後までopenのままにする | PR #25, GitHub Issue #6 | 2026-07-01 |
| D-026 | PR #25がmainへmergeされ、Issue #6はcompletedとしてcloseされた。Issue #6の状態labelは `status: done` に更新済み | PR #25, GitHub Issue #6 | 2026-07-01 |
| D-027 | #7 事業環境・代替手段素材はR/B/P/Judgeレビューを通し、BP-02/BP-04/BP-05/BP-13へ渡せる構造化素材としてIntegration Readyと判定した。ただし対象地域、施設タイプ、参考事例の使用範囲、外部情報解釈、利用者ニーズ検証はHuman Checkに残す | `docs/issue-07-environment-alternatives.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-028 | #7 事業環境・代替手段素材のdraft PR #26を作成し、Issue #7に `integration-ready` と `status: pr-ready` を付与した。Issue #7はPR merge後までopenのままにする | PR #26, GitHub Issue #7 | 2026-07-01 |
| D-029 | PR #26がmainへmergeされ、Issue #7はcompletedとしてcloseされた。Issue #7の状態labelは `status: done` に更新済み | PR #26, GitHub Issue #7 | 2026-07-01 |
| D-030 | #8 初回実証実験計画素材はR/B/P/Judgeレビューを通し、BP-08/BP-12/BP-13へ渡せる構造化素材としてIntegration Readyと判定した。ただし実施場所、日程、対象者、施設承認、保護者説明、安全・衛生、責任範囲、成功基準はHuman Checkに残す | `docs/issue-08-initial-experiment-plan.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-031 | #8 初回実証実験計画素材のdraft PR #27を作成し、Issue #8に `integration-ready` と `status: pr-ready` を付与した。Issue #8はPR merge後までopenのままにする | PR #27, GitHub Issue #8 | 2026-07-01 |
| D-032 | PR #27がmainへmergeされ、Issue #8はcompletedとしてcloseされた。Issue #8の状態labelは `status: done` に更新済み | PR #27, GitHub Issue #8 | 2026-07-01 |
| D-033 | #9 商品・価格仮説素材はR/B/P/Judgeレビューを通し、BP-07/BP-10/BP-11/BP-13へ渡せる構造化素材としてIntegration Readyと判定した。ただし商品範囲、価格、実費回収、食品表示、アレルギー、保管、仕入れ、現金管理はHuman Checkに残す | `docs/issue-09-product-price.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-034 | #9 商品・価格仮説素材のdraft PR #28を作成し、Issue #9に `integration-ready` と `status: pr-ready` を付与した。Issue #9はPR merge後までopenのままにする | PR #28, GitHub Issue #9 | 2026-07-01 |
| D-035 | PR #28がmainへmergeされ、Issue #9はcompletedとしてcloseされた。Issue #9の状態labelは `status: done` に更新済み | PR #28, GitHub Issue #9 | 2026-07-01 |
| D-036 | #10 運営オペレーション素材はR/B/P/Judgeレビューを通し、BP-09/BP-10/BP-13へ渡せる構造化素材としてIntegration Readyと判定した。ただし運営責任者、当日担当、施設協力、事故対応、保険、責任分界、現金管理、食品衛生、記録範囲はHuman Checkに残す | `docs/issue-10-operations-sop.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-037 | #10 運営オペレーション素材のdraft PR #29を作成し、Issue #10に `integration-ready` と `status: pr-ready` を付与した。Issue #10はPR merge後までopenのままにする | PR #29, GitHub Issue #10 | 2026-07-01 |
| D-038 | PR #29がmainへmergeされ、Issue #10はcompletedとしてcloseされた。Issue #10の状態labelは `status: done` に更新済み | PR #29, GitHub Issue #10 | 2026-07-01 |
| D-039 | #11 収益・費用素材はR/B/P/Judgeレビューを通し、BP-11/BP-07/BP-13へ渡せる構造化素材としてIntegration Readyと判定した。ただし費用範囲、価格、赤字許容、無料提供、寄付、施設負担、現金管理、廃棄、継続基準はHuman Checkに残す | `docs/issue-11-revenue-cost.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-040 | #11 収益・費用素材のdraft PR #30を作成し、Issue #11に `integration-ready` と `status: pr-ready` を付与した。Issue #11はPR merge後までopenのままにする | PR #30, GitHub Issue #11 | 2026-07-01 |
| D-041 | PR #30がmainへmergeされ、Issue #11はcompletedとしてcloseされた。Issue #11の状態labelは `status: done` に更新済み | PR #30, GitHub Issue #11 | 2026-07-01 |
| D-042 | #12 施設説明素材はR/B/P/Judgeレビューを通し、BP-04/BP-06/BP-13へ渡せる構造化素材としてIntegration Readyと判定した。ただし施設へ実際に伝える文言、施設候補、承認者、相談順序、施設側協力範囲、安全、衛生、責任、費用、記録はHuman Checkに残す | `docs/issue-12-facility-explanation.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-043 | #12 施設説明素材のdraft PR #31を作成し、Issue #12に `integration-ready` と `status: pr-ready` を付与した。Issue #12はPR merge後までopenのままにする | PR #31, GitHub Issue #12 | 2026-07-01 |
| D-044 | PR #31がmainへmergeされ、Issue #12はcompletedとしてcloseされた。Issue #12の状態labelは `status: done` に更新済み | PR #31, GitHub Issue #12 | 2026-07-01 |
| D-045 | #13 リスク整理素材はR/B/P/Judgeレビューを通し、BP-10/BP-13へ渡せる構造化素材としてIntegration Readyと判定した。ただし営業許可・届出、保健所相談、食品表示、アレルギー、事故対応、保険、責任分界、現金管理、個人情報、施設ルールはHuman Checkに残す | `docs/issue-13-risk-response.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-046 | #13 リスク整理素材のdraft PR #32を作成し、Issue #13に `integration-ready` と `status: pr-ready` を付与した。Issue #13はPR merge後までopenのままにする | PR #32, GitHub Issue #13 | 2026-07-01 |
| D-047 | PR #32がmainへmergeされ、Issue #13はcompletedとしてcloseされた。Issue #13の状態labelは `status: done` に更新済み | PR #32, GitHub Issue #13 | 2026-07-01 |
| D-048 | #14 検証項目・成功基準素材はR/B/P/Judgeレビューを通し、BP-08/BP-12/BP-13へ渡せる構造化素材としてIntegration Readyと判定した。ただし成功基準の採用、実証条件、停止条件、測定項目、記録方法、費用・継続判断はHuman Checkに残す | `docs/issue-14-validation-criteria.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-049 | #14 検証項目・成功基準素材のdraft PR #33を作成し、Issue #14に `integration-ready` と `status: pr-ready` を付与した。Issue #14はPR merge後までopenのままにする | PR #33, GitHub Issue #14 | 2026-07-01 |
| D-050 | PR #33がmainへmergeされ、Issue #14はcompletedとしてcloseされた。Issue #14の状態labelは `status: done` に更新済み | PR #33, GitHub Issue #14 | 2026-07-01 |
| D-051 | #15 統合前チェックはL1 gateとして実行し、#2〜#14をすべて#16初版統合の対象と判定した。差し戻しIssueはない。ただしHuman CheckはBP-13へ未解消のまま統合する | GitHub Issue #15, `docs/loop-run.log.md` | 2026-07-01 |
| D-052 | #16 初版ドラフトは、#2〜#14のIntegration Ready素材だけを使ってBP-01〜BP-14へ統合し、R/B/P/JudgeレビューでIntegration Readyと判定した。ただし外部提出、実証実験、商品・価格、安全・衛生・法規制・責任判断はHuman Checkに残す | `docs/business-plan-draft.md`, `docs/loop-run.log.md` | 2026-07-01 |
| D-053 | #16 初版ドラフトのPR #34を作成し、Issue #16に `integration-ready` と `status: pr-ready` を付与した | PR #34, GitHub Issue #16 | 2026-07-01 |
| D-054 | PR #34がmainへmergeされ、Issue #16はcompletedとしてcloseされた。Issue #16の状態labelは `status: done` に更新済み | PR #34, GitHub Issue #16 | 2026-07-01 |
| D-055 | #17 最終レビューはL1 gateとして実行し、`docs/business-plan-draft.md` はG-01〜G-15とBP-01〜BP-14を満たすため、事業計画書初版としてPassと判定した。ただし外部提出、実証実験、商品・価格、安全・衛生・法規制・責任判断はHuman Checkに残す | GitHub Issue #17, `docs/business-plan-draft.md`, `docs/intend.md` | 2026-07-01 |
| D-056 | 親Issue #1は、#16統合と#17最終レビューPassにより、駄菓子事業計画書初版作成の完了としてcompleted closeした。#18はBP本文対象外のLoop運用Issueであり初版完成のblockerではない | GitHub Issue #1, GitHub Issue #17 | 2026-07-01 |

## 6. 現在の未完了事項

| ID | 対象 | 状態 | 次アクション | Owner |
|---|---|---|---|---|
| S-001 | Loop運用資料 | 整備済み | 必要に応じて運用しながら更新する | Orchestrator |
| S-002 | GitHub Issue品質改善 | 完了 | 更新済みIssueを起点に実行開始可否を判断する | Human / Orchestrator |
| S-003 | 事業計画Issue実行 | 完了。#16 main merge済み / #17 Pass / 親Issue #1 completed | なし。外部共有や実証準備は別Issue候補として扱う | Human / Orchestrator |
| S-004 | PR handoff | open PRなし | なし | pr_babysitter |
| S-005 | Loop運用Issue | #18 open / BP本文対象外 | 必要時にLoop運用改善として別途扱う | Human / Orchestrator |

## 7. Human Queue

| ID | 判断待ち内容 | 関連資料 | 再開条件 |
|---|---|---|---|
| HQ-002 | #2前提台帳のP-003〜P-008を決定事項として扱ってよいか | `docs/issue-02-prerequisite-ledger.md`, GitHub Issue #2 | Humanが承認または修正する |
| HQ-003 | 事業目的、収益方針、実施方針の外部説明表現をどう扱うか | `docs/issue-02-prerequisite-ledger.md`, `docs/projects.md` | Humanが使用可能な表現を指定する |
| HQ-004 | 法規制、衛生、安全、責任範囲の確認先と担当をどうするか | `docs/issue-02-prerequisite-ledger.md`, `docs/denylist.json` | Humanが確認先または判断担当を決める |
| HQ-005 | BP-02の中心WhyとしてW-001を採用してよいか | `docs/issue-03-why-problem.md`, GitHub Issue #3 | Humanが採用、修正、差し戻しを判断する |
| HQ-006 | 外部説明で「地域との接点」「金銭感覚」「思い出づくり」「地域貢献」をどこまで使ってよいか | `docs/issue-03-why-problem.md`, `docs/issue-02-prerequisite-ledger.md` | Humanが使用可能な表現を指定する |
| HQ-007 | 対象年齢、参加条件、付き添い要否をどう仮置きするか | `docs/issue-04-stakeholders.md`, GitHub Issue #4 | Humanが候補条件を指定する、または#8で仮説化する |
| HQ-008 | 保護者説明と同意が必要か、必要ならどの粒度か | `docs/issue-04-stakeholders.md`, `docs/denylist.json` | 実施場所、対象年齢、施設ルール、記録有無を確認する |
| HQ-009 | 施設側の承認者、現場担当者、相談順序をどう確認するか | `docs/issue-04-stakeholders.md`, GitHub Issue #12 | 施設候補ごとの相談先をHumanが確認する |
| HQ-010 | 事業として重視する価値の優先順位をどう置くか | `docs/issue-05-value-experience.md`, GitHub Issue #5 | Humanが主価値を指定する、または#14で検証優先度を仮説化する |
| HQ-011 | 外部説明で「金銭感覚」「教育」「地域貢献」「思い出づくり」をどこまで使ってよいか | `docs/issue-05-value-experience.md`, `docs/issue-03-why-problem.md` | Humanが使用可能表現を指定する |
| HQ-012 | 子どもの行動・発言をどの範囲で記録してよいか | `docs/issue-05-value-experience.md`, GitHub Issue #13 | 写真、個人情報、同意、記録様式を#13で整理する |
| HQ-013 | 初回実証で検討してよい場所候補、施設候補、利用可能スペースをどう置くか | `docs/issue-06-implementation-model.md`, GitHub Issue #6/#12 | Humanが候補条件を指定する、または#8/#12で仮説化する |
| HQ-014 | 実施頻度、時間帯、規模、商品数の上限をどう置くか | `docs/issue-06-implementation-model.md`, GitHub Issue #8/#9/#14 | #8/#9/#14で検証条件へ落とす |
| HQ-015 | 施設承認、安全・衛生、責任分界、現金管理、記録範囲をどう確認するか | `docs/issue-06-implementation-model.md`, `docs/denylist.json`, GitHub Issue #10/#13 | #10/#13で確認先と運用仮説を整理する |
| HQ-016 | #7で想定する対象地域、施設タイプ、利用場面をどこまで仮置きするか | `docs/issue-07-environment-alternatives.md`, GitHub Issue #7/#8/#12 | Humanが候補条件を指定する、または#8/#12で仮説化する |
| HQ-017 | 放課後児童クラブ、子ども食堂、地域イベント、商店などの参考対象を外部説明でどこまで使ってよいか | `docs/issue-07-environment-alternatives.md`, GitHub Issue #7 | Humanが参考事例と表現範囲を判断する |
| HQ-018 | 利用者ニーズ仮説と代替手段との差分をどの順で検証するか | `docs/issue-07-environment-alternatives.md`, GitHub Issue #8/#14 | #8/#14で観察項目、質問項目、成功/失敗条件へ落とす |
| HQ-019 | 初回実証の場所、日程、時間帯、対象年齢、参加条件、人数上限をどう置くか | `docs/issue-08-initial-experiment-plan.md`, GitHub Issue #8/#12 | Humanが候補条件を指定する、または#12/#14で仮説化する |
| HQ-020 | 施設承認、保護者説明、緊急連絡、停止権限、責任分界をどう確認するか | `docs/issue-08-initial-experiment-plan.md`, GitHub Issue #10/#12/#13 | #10/#12/#13で確認先と運用仮説を整理する |
| HQ-021 | 商品範囲、価格帯、食品衛生、営業許可・届出、アレルギー、保管をどう確認するか | `docs/issue-08-initial-experiment-plan.md`, GitHub Issue #9/#13 | #9/#13で商品・価格仮説と安全確認事項を整理する |
| HQ-022 | 記録範囲、写真、個人情報、発話記録、成功/失敗/停止基準をどう置くか | `docs/issue-08-initial-experiment-plan.md`, GitHub Issue #13/#14 | #13/#14で記録方法と判断基準を整理する |
| HQ-023 | 初回実証で扱ってよい商品範囲、商品数、食品/非食品の扱いをどう置くか | `docs/issue-09-product-price.md`, GitHub Issue #9/#13 | Humanが候補範囲を指定する、または#13で確認条件を整理する |
| HQ-024 | 具体的な価格帯、購入上限、無料提供・チケット制の有無をどう置くか | `docs/issue-09-product-price.md`, GitHub Issue #9/#10/#11 | #10/#11で会計・実費回収と合わせてHumanが判断する |
| HQ-025 | 実費回収に含める費用範囲、赤字許容、寄付、施設負担をどう扱うか | `docs/issue-09-product-price.md`, GitHub Issue #11 | #11で収支仮説を作りHumanが判断する |
| HQ-026 | 食品表示、アレルギー、賞味期限、保管、個包装、開封・詰め替えをどう確認するか | `docs/issue-09-product-price.md`, GitHub Issue #13 | #13で確認先、確認方法、判断担当を決める |
| HQ-027 | 現金管理、釣り銭、売上記録、差異時対応をどう運用するか | `docs/issue-09-product-price.md`, GitHub Issue #10/#11 | #10でSOPと役割分担、#11で収支記録へ接続する |
| HQ-028 | 運営責任者、当日の担当者、役割分担、兼務可否をどう置くか | `docs/issue-10-operations-sop.md`, GitHub Issue #10 | Humanが候補者または役割設計を指定する |
| HQ-029 | 施設側の承認者、現場担当者、協力範囲、停止指示経路をどう確認するか | `docs/issue-10-operations-sop.md`, GitHub Issue #12 | #12で説明ポイントと確認質問を整理する |
| HQ-030 | 事故対応、保険、責任分界、緊急連絡、停止権限をどう扱うか | `docs/issue-10-operations-sop.md`, GitHub Issue #13 | #13で確認先と運用仮説を整理する |
| HQ-031 | 現金管理、釣り銭、売上記録、差異時対応、会計責任をどう扱うか | `docs/issue-10-operations-sop.md`, GitHub Issue #11/#13 | #11で収支、#13で金銭リスクを整理する |
| HQ-032 | 保護者説明、同意、写真、個人情報、発話記録、記録保管をどう扱うか | `docs/issue-10-operations-sop.md`, GitHub Issue #13/#14 | #13/#14で記録方法と同意範囲を整理する |
| HQ-033 | 実費回収に含める費用範囲をどう置くか | `docs/issue-11-revenue-cost.md`, GitHub Issue #11 | 商品、備品、運搬、廃棄、運営時間をどこまで含めるかHumanが判断する |
| HQ-034 | 初回実証の予算、費用上限、赤字許容をどう置くか | `docs/issue-11-revenue-cost.md`, GitHub Issue #11/#14 | 検証目的、負担者、期間、上限をHumanが指定する |
| HQ-035 | 無料提供、寄付、施設負担、運営者負担を選択肢に含めるか | `docs/issue-11-revenue-cost.md`, GitHub Issue #11/#12 | 外部説明、会計、責任範囲をHumanが確認する |
| HQ-036 | 現金管理、差異、釣り銭、会計責任をどう扱うか | `docs/issue-11-revenue-cost.md`, GitHub Issue #13 | #13で金銭リスクと責任範囲を整理する |
| HQ-037 | 継続、修正、停止の判断基準をどう置くか | `docs/issue-11-revenue-cost.md`, GitHub Issue #14/#15 | #14で検証項目と成功/失敗基準を整理し、#15で初版統合する |
| HQ-038 | 施設へ実際に伝えてよい目的表現をどう置くか | `docs/issue-12-facility-explanation.md`, GitHub Issue #12 | Humanが外部説明で使う文言を承認または修正する |
| HQ-039 | 相談する施設候補、承認者、相談順序、確認方法をどう置くか | `docs/issue-12-facility-explanation.md`, GitHub Issue #12 | Humanが候補施設または相談先を指定する |
| HQ-040 | 施設に求めてよい場所、時間、備品、職員関与の範囲をどう置くか | `docs/issue-12-facility-explanation.md`, GitHub Issue #12/#13 | 施設候補ごとに条件を確認する |
| HQ-041 | 施設説明に含める安全、衛生、責任、保険、費用、記録の範囲をどう置くか | `docs/issue-12-facility-explanation.md`, GitHub Issue #13/#14 | #13でリスク、#14で検証項目へ整理する |
| HQ-042 | 営業許可・届出、保健所相談、食品取扱範囲の確認先をどう置くか | `docs/issue-13-risk-response.md`, GitHub Issue #13 | Humanが公式確認先、相談要否、担当を決める |
| HQ-043 | 食品表示、アレルギー、賞味期限、保管、開封・小分け・詰め替えをどう確認するか | `docs/issue-13-risk-response.md`, GitHub Issue #13 | 商品候補ごとの確認方法を決める |
| HQ-044 | 事故対応、保険、責任分界、緊急連絡、停止権限をどう扱うか | `docs/issue-13-risk-response.md`, GitHub Issue #13 | 施設、保護者、運営者の役割と連絡先を確認する |
| HQ-045 | 現金管理、釣り銭、売上記録、差異、紛失、寄付・無料提供の扱いをどうするか | `docs/issue-13-risk-response.md`, GitHub Issue #11/#13 | 会計責任、記録粒度、差異時対応をHumanが決める |
| HQ-046 | 保護者説明、同意、対象年齢、参加条件、緊急連絡をどう置くか | `docs/issue-13-risk-response.md`, GitHub Issue #13/#14 | 施設ルールと対象者条件を踏まえて説明範囲を決める |
| HQ-047 | 写真、個人情報、発話記録、観察メモ、記録保管、共有、削除をどう扱うか | `docs/issue-13-risk-response.md`, GitHub Issue #13/#14 | 記録対象、同意、保管方法、共有範囲を決める |
| HQ-048 | 施設ルール、食べる場所、持ち帰り、ゴミ、原状回復をどう確認するか | `docs/issue-13-risk-response.md`, GitHub Issue #12/#13 | 施設候補ごとに禁止事項と確認先を整理する |
| HQ-049 | 実施を止める条件、再開条件、判断保留条件をどう置くか | `docs/issue-13-risk-response.md`, GitHub Issue #14 | #14で成功/修正/停止基準に変換する |
| HQ-050 | 成功、条件付き成功、修正、停止、判断保留の基準候補を採用してよいか | `docs/issue-14-validation-criteria.md`, GitHub Issue #14 | Humanが採用、修正、差し戻しを判断する |
| HQ-051 | 初回実証で優先して検証する仮説をどれに絞るか | `docs/issue-14-validation-criteria.md`, GitHub Issue #14 | HumanがWhy/What/How/リスク/収支の優先順位を決める |
| HQ-052 | 測定項目と記録方法の粒度をどう置くか | `docs/issue-14-validation-criteria.md`, GitHub Issue #14 | 記録担当、様式、保管方法、個人情報扱いを決める |
| HQ-053 | 実施前ゲートと停止条件をどの粒度で採用するか | `docs/issue-14-validation-criteria.md`, GitHub Issue #13/#14 | 施設、保護者、安全・衛生、責任範囲の確認先を決める |
| HQ-054 | 保護者・施設へ確認する質問項目をどう設計するか | `docs/issue-14-validation-criteria.md`, GitHub Issue #12/#14 | 外部説明文ではなく確認項目としてHumanが承認する |
| HQ-055 | 実費回収、赤字許容、費用負担、無料/寄付/チケットの評価方法をどう置くか | `docs/issue-14-validation-criteria.md`, GitHub Issue #11/#14 | #11と合わせてHumanが判断する |
| HQ-056 | #15初版統合へ進めてよい条件をどう置くか | `docs/issue-14-validation-criteria.md`, GitHub Issue #15 | HumanまたはOrchestratorが未確認事項の残し方を判断する |
| HQ-057 | #16初版ドラフトで新しい主張を追加せず、#2〜#14の素材だけでBP-01〜BP-14を構成できているか | GitHub Issue #15/#16, `docs/intend.md` | #16のReview / Judgeで確認する |
| HQ-058 | BP-13へ残すHuman Checkを解消済みのように見せていないか | GitHub Issue #16/#17, `docs/denylist.json` | #16のVerifierと#17最終レビューで確認する |
| HQ-059 | 初版ドラフトを外部相談のたたき台として使ってよい範囲をどう置くか | GitHub Issue #16/#17 | Humanが外部共有前の使用範囲を判断する |
| HQ-060 | #17最終レビューで、`docs/business-plan-draft.md` がG-01〜G-15を満たすか、外部提出版に見えないか、Human Checkを解消済みに見せていないかを判定する | `docs/business-plan-draft.md`, `docs/intend.md`, GitHub Issue #17 | PR #16 merge後に#17をL1レビューとして実行する |
| HQ-061 | 初版完成後、外部共有、施設相談、保護者説明、法規制・衛生・安全、商品・価格、実証実験へ進む範囲をどう承認するか | `docs/business-plan-draft.md`, GitHub Issue #17 | Humanが次フェーズの範囲と担当を決める |

## 8. 参照すべき中核資料

| 資料 | 役割 |
|---|---|
| `docs/projects.md` | 上位目的 |
| `docs/intend.md` | 事業計画書初版のゴール判定表 |
| `docs/loop.md` | Loop全体運用、停止条件 |
| `docs/levels.md` | L1 / L2 / L3分岐基準 |
| `docs/denylist.json` | L3除外条件 |
| `docs/dailytriage.md` | Issue棚卸しLoop pattern |
| `docs/pr-babysitter.md` | PR監視Loop pattern |
| `docs/loop-run.log.md` | Loop実行ログ、メトリクス監視 |
| `agents/agent_list.md` | エージェント早見表 |
| `agents/README.md` | エージェント仕様一覧と基本処理フロー |

## 9. 再開時チェックリスト

1. `docs/state.md` を読む。
2. `docs/loop-run.log.md` で停止条件に該当していないか確認する。
3. `docs/loop.md` でLoop patternと停止条件を確認する。
4. `agents/agent_list.md` で起動候補エージェントを確認する。
5. 対象がIssueなら `daily_triage`、PRなら `pr_babysitter` を使う。
6. Triage結果をOrchestratorが採用または差し戻す。
7. 必要な場合だけL2 / L3の実行へ進む。

## 10. 状態更新テンプレート

```md
## State Update

- updated_at:
- updated_by:
- trigger:
- loop_pattern:
- target:
- current_phase:
- status_before:
- status_after:
- level:
- denylist_check:
- changed_files:
- human_queue:
- control_stage: none / 速度を落とす / 一時停止
- run_id:
- last_decision_by:
- resume_condition:
- resume_owner:
- next_action:
- notes:
```

## 11. Human Queue確認テンプレート

```md
## Human Queue Request

- request_id:
- target:
- reason:
- 判断してほしい事項:
- 選択肢:
- 推奨案:
- リスク:
- 再開条件:
- resume_owner:
```
