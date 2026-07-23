# PR Babysitter Loop Pattern

## 1. この文書の役割

この文書は、駄菓子事業計画書作成Loopにおける `pr_babysitter` パターンの使い方を定義する。

`pr_babysitter` は、L2で作成されたPRを監視し、レビュー待ち、CI失敗、差し戻し、merge待ち、滞留を検知して、次に誰が何をすべきかを明確にするためのLoop patternである。

このパターンはPRをmergeしない。必要な修正がある場合も、PR上で勝手に実装を進めず、OrchestratorへL2再実行候補として返す。

## 2. 使うタイミング

以下の場合に `pr_babysitter` を使う。

| 条件 | 目的 |
|---|---|
| L2でPRが作成された後 | PRが人間レビュー可能な状態か確認する |
| CIまたは検証が失敗した時 | 失敗内容を分類し、L2再実行か人間判断かを分ける |
| レビューコメントが付いた時 | 対応要否と次担当を整理する |
| PRが滞留している時 | 人間レビュー待ち、修正待ち、情報不足を明確にする |
| merge前の確認が必要な時 | merge可能性と未解決事項を一覧化する |

Issue本体の初期分類、章ID付与、L分類、denylist初回確認は `docs/dailytriage.md` を使う。

## 3. 実行間隔

標準の実行間隔は以下とする。

| 状態 | 実行間隔 |
|---|---|
| open PRがない | 実行しない |
| open PRがある通常時 | 1日2回まで確認する |
| PR作成直後 | 手動で即時確認する |
| CI完了、レビュー投稿、merge conflict発生 | イベント発生時に確認する |
| 人間レビュー待ちのみ | 1日1回まで確認し、過剰通知しない |

標準時刻が必要な場合は、日本時間の昼前と夕方に確認する。CIやレビューコメントのイベントが取れる場合は、定期実行よりイベント駆動を優先する。

## 4. 入力

`pr_babysitter` は、少なくとも以下を確認する。

- `docs/projects.md`
- `docs/intend.md`
- `docs/levels.md`
- `docs/loop.md`
- `docs/denylist.json`
- 対象PR本文
- 対象PRの差分
- 関連Issue
- CI、lint、検証結果
- レビューコメント、変更要求、未解決スレッド
- merge conflictの有無

## 5. 振る舞い

`pr_babysitter` は以下の順で処理する。

1. 対象PRがopenか確認する。
2. 関連Issue、章ID、L分類、変更種別を確認する。
3. PR差分が `docs/denylist.json` に触れていないか確認する。
4. CI、lint、検証、レビュー状態を確認する。
5. PRがmerge可能か、人間レビュー待ちか、修正待ちか、情報不足かを分類する。
6. 修正が必要な場合は、OrchestratorへL2再実行候補として返す。
7. 人間判断が必要な場合は、Human Queue理由を記録する。
8. merge可能に見える場合でも、mergeは人間に委ねる。

## 6. Levelとの関係

| PR状態 | `pr_babysitter` の出力 | 次の扱い |
|---|---|---|
| 検証通過、レビュー待ち | 人間レビュー待ちとして記録する | Human Review |
| 検証通過、承認済み | merge可能候補として記録する | Human Merge |
| CI失敗、lint失敗、差分不足 | 失敗理由を分類する | OrchestratorがL2再実行を判断する |
| レビューで修正要求あり | 未解決コメントと対応方針を記録する | OrchestratorがL2再実行を判断する |
| denylist該当差分あり | 該当カテゴリ、項目ID、理由を記録する | Human Queue |
| merge conflictあり | conflict対象を記録する | Human QueueまたはL2再実行 |
| PRがclose済みまたはmerge済み | 結果を記録する | Log / Done判定へ渡す |

## 7. 出力契約

`pr_babysitter` は以下の形式で出力する。

```md
## PR Babysitter Result

- loop_pattern: pr_babysitter
- pattern_source: docs/pr-babysitter.md
- pr_url:
- related_issue:
- target_chapter:
- level:
- current_pr_state:
- checks_state:
- review_state:
- merge_conflict:
- denylist_check:
- denylist_source: docs/denylist.json
- unresolved_comments:
- required_action:
- next_owner: human / orchestrator / implementer / verifier / none
- handoff_to: human / orchestrator / log / none
- human_queue_reason:
- ready_for_human_merge: yes / no
```

## 8. 停止条件

以下のいずれかで `pr_babysitter` は停止する。

- PRが人間レビュー待ちであることを記録した。
- PRが人間merge待ちであることを記録した。
- CI、検証、レビューコメントの未解決事項を整理し、L2再実行候補として返した。
- denylist該当または人間判断必須事項をHuman Queue理由として記録した。
- close済みまたはmerge済みの結果を記録した。

## 9. 禁止事項

- PRをmergeしない。
- 人間承認なしに外部公開、送信、共有をしない。
- レビューコメントに対する本文修正をこのパターン単独で行わない。
- CI失敗を見ただけで勝手にcommitやpushをしない。
- denylist該当差分を自動で処理しない。
- 人間確認必須事項を確定しない。
