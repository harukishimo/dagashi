# Loop 運用方法

## 1. この文書の役割

この文書は、駄菓子事業計画書作成におけるLoop Engineeringの運用方法を定義する。

`docs/intend.md` はゴール判定表である。L1 / L2 / L3の分岐基準は `docs/levels.md` に定義する。この文書では、Triage、Implementer、Verifier、Orchestratorがどの順番で動くかを定義する。

## 2. 基本方針

- 最終成果物は駄菓子事業計画書初版である。
- Loop Engineeringは、事業計画書初版を作るための手段である。
- すべてのIssue成果物は、事業計画書の章IDへ接続する。
- 現時点で採用するLoop patternは `daily_triage` と `pr_babysitter` の2つだけである。
- Loop patternは実行の巡回方法を決める。L分類は起動する役割と停止位置を決める。
- セッションをまたぐ状態共有は `docs/state.md` を使う。
- Loop実行ログと運用メトリクスは `docs/loop-run.log.md` を使う。
- エージェント特徴の早見表は `agents/agent_list.md` を使う。
- L1はレポートのみ。
- L2はPR作成まで。
- L3はdenylist外に限りAuto-commitまで。

## 3. 採用するLoop pattern

| Pattern | 目的 | 主に見る対象 | 主な起動タイミング | 詳細 |
|---|---|---|---|---|
| `daily_triage` | 未整理Issue、停滞Issue、人間判断待ちを棚卸しし、章ID、L分類、denylist該当、次アクションを記録する | Issue、Status、既存出力 | 1日1回、作業開始時。Issue作成直後や統合前は手動実行 | `docs/dailytriage.md` |
| `pr_babysitter` | L2で作成されたPRを監視し、レビュー待ち、CI失敗、差し戻し、merge待ちを整理する | open PR、CI、レビューコメント、関連Issue | open PRがある時だけ。通常は1日2回まで、CIやレビューイベント時は都度確認 | `docs/pr-babysitter.md` |

TriageはLoop pattern候補を提示する。Orchestratorは、対象がIssue本体なら `daily_triage`、PR作成後なら `pr_babysitter` を採用する。

上記以外のLoop patternは、別文書で定義されるまで使わない。

## 4. 役割

| 役割 | 責務 |
|---|---|
| Orchestrator | 全体制御、Loop patternの採用、L分類の採用、Status管理、人間キュー昇格判断 |
| Triage | Loop pattern候補、状態、章ID候補、L分類候補、denylist該当、必要対応案を出力する |
| Implementer | L2 / L3で新規作成、更新、移動、分割などの変更を実施する |
| Verifier | L2 / L3でテスト、lint、整合性、実差分ベースのdenylist再確認を行う。現時点ではReview Agentが兼務する |
| Human | L1の判断、L2のmerge、denylist該当事項の判断を行う |

## 5. 採用方式

本LoopではB方式を採用する。

- Orchestratorは各役割の起動条件、入力、出力、禁止事項を前提知識として保持する。
- `agents/*.md` は役割定義の原本、監査基準、実装時の参照仕様として扱う。
- サブエージェントは自律的に別サブエージェントを起動しない。
- サブエージェントは次工程を提案できる。
- 起動可否、順序変更、Status変更はOrchestratorが判断する。

## 6. Level別フロー

| Level | フロー | 停止位置 |
|---|---|---|
| L1 | Triage -> Orchestrator採用 -> 人間キュー | 人間判断待ち |
| L2 | Triage -> Orchestrator採用 -> Requirements -> Research -> Analysis -> Implementer -> Verifier -> PR作成 -> 人間レビュー | PR作成後。mergeは人間 |
| L3 | Triage -> Orchestrator採用 -> denylist確認 -> Implementer -> Verifier -> 実差分denylist再確認 -> Auto-commit -> ログ記録 | Auto-commit後。denylist内は人間キュー |

## 7. L1 - レポートのみ

L1ではImplementer / Verifierを起動しない。

Triageは以下を出力する。Status変更やファイル更新はOrchestratorまたはKnowledge / Log Agentが行う。

- loop_pattern
- pattern_source
- target_chapter
- level
- denylist_check
- current_state
- reason
- missing_information
- human_decision_required
- recommended_next_action

L1では、事業計画書成果物としてのファイル新規作成、更新、移動、削除、検証、commit、PR作成、mergeを行わない。

## 8. L2 - アシスト変更

L2ではImplementerとVerifierを起動する。

処理順序:

1. Triageが章ID候補、L分類候補、denylist該当有無、作業範囲案を出力する。
2. Implementerが新規作成、更新、移動、分割などの変更を行う。
3. Verifierがテスト、lint、整合性、差分を検証する。
4. Verifierが実差分ベースで `docs/denylist.json` を再確認する。
5. 検証と実差分denylist再確認が通った場合、OrchestratorがPR作成を許可する。
6. PR作成後に停止する。
7. mergeは人間が行う。

検証に失敗した場合は、PR作成せず `Changes Requested` または人間キューへ送る。

Requirements、Research、Analysisを省略する場合、Orchestratorは省略理由を `docs/loop-run.log.md` に記録する。

## 9. L3 - 無人実行

L3では、denylist外の変更に限り、ImplementerとVerifierを起動し、新規作成、更新、移動、分割、Auto-commitまで行う。

処理順序:

1. Triageが `docs/denylist.json` を確認し、denylistに該当しないことを確認する。
2. Implementerが変更する。
3. Verifierがテスト、lint、整合性、差分を検証する。
4. Verifierが実差分ベースで `docs/denylist.json` を再確認する。
5. 検証と実差分denylist再確認が通った場合、Auto-commitする。
6. commit情報、検証結果、差分概要をログに残す。

denylistに該当する場合、L3を中止して人間キューへ昇格する。

## 10. denylist

denylist本体は `docs/denylist.json` に定義する。`docs/levels.md` はL分類とdenylist参照手順だけを定義する。

denylistに該当した場合:

- L3無人実行は禁止する。
- Triageが `docs/denylist.json` の該当カテゴリと項目IDを記録する。
- Triageが該当理由を書き込む。
- Orchestratorが人間キューへ昇格する。
- 人間判断後に、L1またはL2として再投入する。

## 11. Status遷移

| 遷移 | 実行者 | 条件 |
|---|---|---|
| Backlog -> Triaged | Orchestrator | Triageが章ID候補、L分類候補、denylist該当有無を出力し、Orchestratorが採用した |
| Triaged -> Human Queue | Orchestrator | L1、denylist該当、情報不足、人間判断待ち |
| Triaged -> In Progress | Orchestrator | L2またはL3として実行可能 |
| In Progress -> Verifying | Implementer | 変更が完了した |
| Verifying -> Changes Requested | Verifier | 検証失敗または変更不足 |
| Verifying -> PR Ready | VerifierまたはOrchestrator | L2で検証通過しPR作成済み |
| Verifying -> Auto Committed | VerifierまたはOrchestrator | L3で検証通過しAuto-commit済み |
| PR Ready -> Done | Human | 人間がmergeまたは完了判断した |
| Auto Committed -> Done | Orchestrator | commitログと検証ログが記録済み |

## 12. Triageへの引き渡し情報

Triageまたは将来のTriageエージェントは、以下の順で参照する。

1. `docs/loop.md` で採用済みLoop patternを確認する。
2. `docs/state.md` でセッションをまたぐ現在状態を確認する。
3. `docs/loop-run.log.md` で速度低下または一時停止条件を確認する。
4. Issue本体の棚卸しなら `docs/dailytriage.md` を読む。
5. PR作成後の監視なら `docs/pr-babysitter.md` を読む。
6. `docs/levels.md` でL分類を確認する。
7. `docs/denylist.json` でL3除外条件を確認する。

Triageは、必ず `loop_pattern` と `pattern_source` を出力に含める。

## 13. サブエージェント出力契約

| 項目 | 内容 |
|---|---|
| loop_pattern | `daily_triage` または `pr_babysitter` |
| pattern_source | `docs/dailytriage.md` または `docs/pr-babysitter.md` |
| target_chapter | 接続先の章ID |
| level | L1 / L2 / L3 |
| denylist_check | denylist該当有無と該当理由 |
| denylist_source | `docs/denylist.json` |
| current_state | 現在の状態 |
| summary | 実行内容の短い要約 |
| change_type | 新規作成、更新、移動、分割、削除、なし |
| changed_files | L2 / L3で変更したファイル |
| verification_result | L2 / L3での検証結果。Review AgentがVerifierを兼務する |
| diff_denylist_check | 実差分ベースのdenylist再確認結果 |
| pr_url | L2で作成したPR |
| commit_id | L3で作成したcommit |
| human_queue_reason | 人間キューへ昇格する理由 |
| handoff_to | human / orchestrator / pr_babysitter / log / none |
| next_action | 次に必要な対応 |

## 14. 完了条件

| Level | 完了条件 |
|---|---|
| L1 | Triage結果をOrchestratorが採用し、人間判断待ちになっている |
| L2 | ImplementerとVerifierが実行され、PR作成後に停止している |
| L3 | denylist外であることを確認し、検証通過後にAuto-commitとログ記録が完了している |

## 15. 停止条件

停止条件は `docs/loop-run.log.md` のメトリクスをもとに判断する。段階は「速度を落とす」と「一時停止」の2つだけとする。

| 段階 | 条件 | 実行すること | 停止すること |
|---|---|---|---|
| 速度を落とす | token-per-taskがベースラインの2倍超、false positive rateが30%超、context window occupancyが85%超 | 対象数を絞る、L3を控える、`docs/state.md` を更新する、Human Queueを整理する、Red / Blue / Purple Teamで運用確認する | 複数対象の並列処理、曖昧なままのL2実行、新規L3 |
| 一時停止 | 同一対象へのloop iterationsが3回超、denylist該当が不明、速度低下後もfalse positiveが改善しない、contextを要約できない | `docs/state.md` と `docs/loop-run.log.md` を更新する、停止理由をHuman Queueへ送る、再開条件を明示する | 新規実行、PR作成、Auto-commit、merge、外部副作用 |

再開条件:

- `docs/state.md` に `resume_condition` と `resume_owner` が記録されている。
- `docs/loop-run.log.md` に停止理由、しきい値、次アクションが記録されている。
- Human Queue理由が解消済み、またはHumanが再開を承認している。
- 速度低下の場合は、対象数、L3可否、同時実行可否が明示されている。
- 一時停止の場合は、Orchestratorが再開対象と再開Levelを明示している。

Red / Blue / Purple Teamの役割:

- Red Teamは、停止条件の見落とし、過剰実行、false positive、denylist見落としを指摘する。
- Blue Teamは、速度を落として継続するための対象分割、ログ補強、Human Queue化を提案する。
- Purple Teamは、Red / Blueの結果から「速度を落とす」か「一時停止」かをOrchestratorの判断材料として整理する。

最終的に速度を落とすか一時停止するかはOrchestratorが採用する。Triage、Red Team、Blue Team、Purple Teamは判断材料を作るが、停止段階を確定しない。

## 16. 禁止事項

- 定義されていないLoop patternを使わない。
- L1でImplementer / Verifierを起動しない。
- L2でPR mergeしない。
- L3でdenylist該当変更を実行しない。
- L3で外部公開、送信、push、PR作成、Issue closeを行わない。例外が必要な場合はL3では扱わず、人間承認済みL2または専用runbookへ昇格する。
- どのLevelでも、人間確認必須事項をAIだけで確定しない。
