# Agent List

## 1. この文書の役割

この文書は、Orchestratorが各エージェントの特徴、起動タイミング、主な出力、禁止事項を素早く確認するための早見表である。

詳細仕様は各 `agents/*.md` を正とする。この文書は詳細仕様の代替ではなく、起動判断の入口として使う。

## 2. 起動判断の原則

- 最初にOrchestratorが対象を確認する。
- IssueまたはPRの初期診断はTriage Agentに渡す。
- Triage Agentは候補を出すだけで、起動順やStatus変更を確定しない。
- L1ではImplementer / Verifierを起動しない。
- L2ではPR作成までで止め、mergeはHumanが行う。
- L3ではdenylist外に限りAuto-commitまで行う。
- Red / Blue / Purple Teamは主要Issue、しきい値到達時、L3候補、denylist unknown時に起動する。
- Verifierは現時点では独立エージェントではなく、Review Agentが兼務する。

## 3. エージェント早見表

| No | Agent | 主な役割 | 起動タイミング | 主な出力 | 禁止事項 | 詳細 |
|---|---|---|---|---|---|---|
| 01 | Orchestrator | 全体制御、Loop pattern採用、L分類採用、Status管理、起動判断 | 全Issue / PR / Status変更前 | 処理方針、起動順、Status判断 | サブエージェントへ起動権限を委譲しない | `agents/01_orchestrator.md` |
| 14 | Triage | Issue / PR初期診断、章ID候補、L分類候補、denylist確認 | `daily_triage`、`pr_babysitter` | Triage Result、Human Queue理由、handoff先 | Status変更、実装、PR作成、Auto-commitをしない | `agents/14_triage_agent.md` |
| 02 | Requirements | 目的、前提、制約、成果物、スコープ整理 | 子Issue開始時、スコープ曖昧時 | Issue目的、スコープ、TODO、完了条件 | 曖昧なまま作成へ渡さない | `agents/02_requirements_agent.md` |
| 03 | Research | 内部前提、外部情報、参考事例、確認事項収集 | 情報収集が必要な時 | 調査結果、出典、要調査 | 未確認情報を事実化しない | `agents/03_research_agent.md` |
| 04 | Analysis | 論点分析、示唆、優先度整理 | 情報整理後 | 分析結果、論点、示唆 | 根拠なしに結論を確定しない | `agents/04_analysis_agent.md` |
| 05 | Creation / Implementer | 統合用素材、計画書、テンプレート作成 | L2 / L3で変更が必要な時 | 成果物、統合用サマリ、変更ファイル | レビュー未完了を統合済みにしない | `agents/05_creation_implementation_agent.md` |
| 06 | Review / Verifier | 要件、抜け漏れ、根拠、分類確認、実差分ベースのdenylist再確認 | 各Issueの成果物作成後、PR作成前、Auto-commit前 | OK / 条件付きOK / 要修正 / 要追加調査、diff_denylist_check | 根拠不足とdenylist該当差分を見逃さない | `agents/06_review_agent.md` |
| 07 | Red Team | 失敗要因、反論、リスク、前提破綻の検証 | 主要Issue、停止条件確認時 | リスク、反論、破綻条件 | 改善策だけに寄せない | `agents/07_red_team_agent.md` |
| 08 | Blue Team | Red Team指摘への改善策、代替案、補強策 | Red Team後 | 改善策、代替案、要検証化 | リスクを無視して正当化しない | `agents/08_blue_team_agent.md` |
| 09 | Purple Team | Red / Blue統合、採用・保留・差し戻し整理 | Red / Blue後 | 採用判断、修正方針、追加Issue候補 | 都合よく統合しない | `agents/09_purple_team_agent.md` |
| 10 | Integration | レビュー済み情報を統合用サマリへ整理 | Integration Ready前、最終統合時 | 統合サマリ、反映方針 | 未レビュー情報を統合しない | `agents/10_integration_agent.md` |
| 11 | Judge | Integration Ready、Integrated、Done可否判定 | Status判定時 | Pass / Conditional Pass / Fail | 条件未達をPassにしない | `agents/11_judge_agent.md` |
| 12 | Knowledge / Log | 決定事項、変更履歴、未解決論点を記録 | 各Issue終盤、Status変更時 | 履歴、決定事項、ログ | 未確定事項を決定事項にしない | `agents/12_knowledge_log_agent.md` |
| 13 | Effort Estimation | WBS、3点見積もり、AI短縮可能工数整理 | 工数整理が必要な時 | 見積もり、工数、前提 | 根拠なしの工数断定をしない | `agents/13_effort_estimation_agent.md` |

## 4. よく使う起動順

### Issue棚卸し

```text
Orchestrator -> Triage -> Orchestrator判断
```

### L2通常実行

```text
Orchestrator -> Triage -> Requirements -> Research -> Analysis -> Creation / Implementer -> Review / Verifier -> Red / Blue / Purple -> Integration -> Judge -> PR作成 -> Loop pattern: pr_babysitter
```

Red / Blue / Purpleは主要Issueまたはリスクが高いIssueで起動する。

### L3低裁量実行

```text
Orchestrator -> Triage -> denylist確認 -> Implementer -> Review / Verifier -> 実差分denylist再確認 -> Auto-commit -> Knowledge / Log
```

### PR監視

```text
Orchestrator -> Loop pattern: pr_babysitter -> Triage -> Orchestrator判断 -> Human Review / L2再実行 / Human Queue
```

## 5. 停止段階ごとの許可エージェント

| 段階 | 起動できるエージェント | 起動しないエージェント |
|---|---|---|
| 通常 | 必要な全エージェント | なし |
| 速度を落とす | Orchestrator, Triage, Review / Verifier, Red Team, Blue Team, Purple Team, Knowledge / Log, Human | 新規L3向けImplementer、不要な並列エージェント |
| 一時停止 | Orchestrator, Triage, Red Team, Blue Team, Purple Team, Knowledge / Log, Human | Implementer, PR作成, Auto-commit, 外部副作用を伴う処理 |
