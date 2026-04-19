# ⛩️ Monzenmachi Benchmark Endpoints

このノードは、AIエージェントのプロトコル実装を検証するための決定論的エンドポイントを提供します。

## 思想
Skill routes（おみくじ等）が「実用」を目的とするのに対し、Benchmark endpointsは「仕様準拠」を確認するためのものです。

## Endpoints

### 1. `GET /api/agent/benchmark/ping`
- **目的**: L402/MPPの最小ハンドシェイク検証
- **価格**: 10 SATS / 1 Faucet Ticket
- **期待される挙動**: 
    - 402応答のヘッダーが標準に準拠しているか
    - 決済後のリクエストで決定論的なJSONが返るか

### 2. `POST /api/agent/benchmark/echo`
- **目的**: 有料POSTリクエストのペイロード整合性検証
- **入力**: `{ "text": "string" }`
- **期待される挙動**: 
    - 送信した `text` がそのまま返却されるか
    - 認証ヘッダー付与によるボディの破損がないか