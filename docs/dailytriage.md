# Daily Triage Loop Pattern

## 1. この文書の役割

この文書は、駄菓子事業計画書作成Loopにおける `daily_triage` パターンの使い方を定義する。

`daily_triage` は、未整理のIssueや停滞している作業を毎日確認し、状態、章ID、L分類、denylist該当有無、次アクションを記録するためのLoop patternである。

このパターンは実装、検証、PR作成、merge、Auto-commitを行わない。実行するのはTriageまでであり、次にどのLevelや役割へ渡すべきかを整理する。

## 2. 使うタイミング

以下の場合に `daily_triage` を使う。

| 条件 | 目的 |
|---|---|
| 1日の作業開始時 | 未整理Issue、停滞Issue、人間判断待ちを棚卸しする |
| 新しいIssue群を作成した後 | 章ID、L分類、denylist該当、次アクションを付与する |
| 前回作業から時間が空いた時 | 現在状態を再確認し、古い判断を更新する |
| `Backlog`、`Ready`、`Blocked`、`Changes Requested` が増えた時 | 着手可能性と人間確認事項を分離する |
| PRではなくIssue本体の状態を確認したい時 | PR監視ではなくIssue処理方針を決める |

PR作成後の監視、CI結果、レビューコメント、merge待ちは `docs/pr-babysitter.md` を使う。

## 3. 実行間隔

標準の実行間隔は以下とする。

| 状態 | 実行間隔 |
|---|---|
| 通常運用 | 1日1回、作業開始時に実行する |
| Issueをまとめて作成した直後 | 手動で即時実行する |
| 人間判断待ちが多い時 | 1日1回を維持し、同じ内容を何度も通知しない |
| 事業計画書の統合作業前 | 統合前に手動で実行する |

標準時刻が必要な場合は、日本時間の午前中に実行する。厳密な時刻よりも、毎日の作業開始前に状態をそろえることを優先する。

## 4. 入力

`daily_triage` は、少なくとも以下を確認する。

- `docs/projects.md`
- `docs/intend.md`
- `docs/levels.md`
- `docs/loop.md`
- `docs/denylist.json`
- Issue本文
- Issueの現在Status
- 既存コメント、既存エージェント出力、関連PRの有無

## 5. 振る舞い

`daily_triage` は以下の順で処理する。

1. 対象Issueの現在Statusを確認する。
2. 事業計画書の章IDへ接続できるか確認する。
3. `docs/denylist.json` を確認し、L3禁止条件に該当するか確認する。
4. `docs/levels.md` に従ってL1 / L2 / L3候補を判定する。
5. 人間判断が必要な事項、情報不足、次に読むべき資料を整理する。
6. 次に起動すべき役割を提案する。
7. PRがすでに存在する場合は、`pr_babysitter` へ引き渡す。

`daily_triage` は、Issueを実行するための前処理である。L2やL3に分類できる場合でも、このパターン自体がImplementerやVerifierを起動するわけではない。

## 6. Levelとの関係

| 判定結果 | `daily_triage` の出力 | 次の扱い |
|---|---|---|
| L1 | 状態、理由、人間判断事項を記録する | Human Queue |
| L2 | 変更対象、検証方法、PR停止条件を記録する | OrchestratorがL2実行を判断する |
| L3 | denylist外である根拠、Auto-commit可否を記録する | OrchestratorがL3実行を判断する |
| denylist該当 | 該当カテゴリ、項目ID、理由を記録する | Human Queue |
| PRあり | PR URLと現在状態を記録する | `pr_babysitter` へ渡す |

## 7. 出力契約

Triageは以下の形式で出力する。

```md
## Daily Triage Result

- loop_pattern: daily_triage
- pattern_source: docs/dailytriage.md
- target_issue:
- target_chapter:
- current_status:
- proposed_status:
- level:
- denylist_check:
- denylist_source: docs/denylist.json
- trigger_reason:
- current_state:
- missing_information:
- human_decision_required:
- recommended_next_action:
- handoff_to: human / orchestrator / pr_babysitter / none
- related_pr:
```

## 8. 停止条件

以下のいずれかで `daily_triage` は停止する。

- 対象Issueの状態、章ID、L分類、次アクションを記録した。
- 人間判断が必要な事項をHuman Queueへ送る理由として記録した。
- PRが存在し、`pr_babysitter` へ引き渡す情報を記録した。
- 情報不足で判断できず、追加で必要な入力を記録した。

## 9. 禁止事項

- Implementerを起動しない。
- Verifierを起動しない。
- 事業計画書本文や統合用素材を作成、更新、削除しない。
- commit、push、PR作成、merge、Auto-commitを行わない。
- 人間確認必須事項を確定しない。
- PRのレビューコメント対応やCI修正をこのパターンで処理しない。
