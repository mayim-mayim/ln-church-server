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

### 3. Corpus Replay Endpoints (Synthetic)
- **GET `/api/agent/benchmark/replay/:corpus_id`**
- **GET `/api/agent/benchmark/replay/:corpus_id/challenge`**
- **目的**: LN教本殿で観測された `Interop Corpus API` の知識を利用し、エージェントが `challenge shape` や `expected_client_behavior` を解析できるか検証するための合成(synthetic)エンドポイントです。
- **重要**: これは **raw exact wire replay (完全な通信レベルのリプレイ)** ではありません。本殿の Corpus API から取得した正規化済みメタデータを元に、サーバーが動的に構成した `synthetic_from_corpus_v1` による再現環境です。
- **構成**: Server は本殿 Corpus を実行可能な benchmark に変換する役割のみを担います。実決済の検証は主目的ではありません。