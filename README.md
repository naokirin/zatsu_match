# Zatsu Match

Slack上で空いている日時を登録し、同じ時間に空いている人と自動的にマッチングさせて、ハドルを勝手に起動するサーバーレスアプリケーションです。

## 機能

- Slack上で空いている日時を登録
- 登録した日時の確認と削除
- 30分おきに自動マッチング処理を実行
- マッチング成立時に自動でハドルを作成
- 参加者への自動通知

## アーキテクチャ

- Slackbot API: AWS Lambda (TypeScript)
- データストア: Amazon DynamoDB
- マッチング処理: AWS Step Functions + Lambda
- 通知: Amazon EventBridge + SNS
- Slackハドル起動: AWS Lambda
- 認証: Slack OAuth + AWS Secrets Manager
- デプロイ: AWS SAM

## 前提条件

- Node.js 23.x以上
- AWS CLI
- AWS SAM CLI
- Slackワークスペースの管理者権限

## ローカルでの実行方法

1. リポジトリのクローン
```bash
git clone [repository-url]
cd zatsu-match
```

2. 依存関係のインストール
```bash
npm install
```

3. 環境変数の設定
```bash
cp .env.example .env
```
`.env`ファイルに以下の値を設定：
```
SLACK_BOT_TOKEN=your_slack_bot_token
DYNAMODB_TABLE=your_dynamodb_table_name
MAX_USERS_PER_MATCH=5
```

4. ビルド
```bash
npm run build
```

5. ローカルでの実行
```bash
sam local start-api
```

## Slackアプリの設定

1. [Slack API](https://api.slack.com/apps)にアクセスし、新しいアプリを作成

2. 以下の権限を追加：
   - `chat:write`
   - `conversations:write`
   - `im:write`
   - `users:read`

3. イベントサブスクリプションを有効化
   - ローカル開発時: ngrokなどのツールを使用してローカルエンドポイントを公開
   - 本番環境: デプロイ後のAPIエンドポイントを設定

4. アプリをワークスペースにインストール

## デプロイ方法

1. AWS Secrets Managerにシークレットを作成
```bash
aws secretsmanager create-secret \
  --name zatsu-match-secrets \
  --secret-string '{"SLACK_BOT_TOKEN":"your_slack_bot_token"}'
```

## 利用方法

### Slack上での空き時間の登録方法

1. Zatsu Matchボットに直接メッセージを送る、または専用チャンネルでボットをメンションします。

2. 空き時間を登録するコマンド：
```
/zatsu_match register 2023-12-15 13:00-15:00
```
または
```
@ZatsuMatch register 2023-12-15 13:00-15:00
```

3. 複数の時間帯を一度に登録することも可能です：
```
/zatsu_match register 2023-12-15 13:00-15:00, 2023-12-16 10:00-12:00
```

4. 登録が完了すると、確認メッセージが表示されます。

### 登録した空き時間の確認方法

1. 以下のコマンドで自分が登録した空き時間を確認できます：
```
/zatsu_match list
```
または
```
@ZatsuMatch list
```

2. 登録されている空き時間の一覧が表示されます。

### 登録した空き時間の削除方法

1. 特定の空き時間を削除するには：
```
/zatsu_match delete 2023-12-15 13:00-15:00
```
または
```
@ZatsuMatch delete 2023-12-15 13:00-15:00
```

2. すべての登録を削除するには：
```
/zatsu_match delete all
```

3. 削除が完了すると、確認メッセージが表示されます。

### マッチング後の通知

マッチングが成立すると、参加者に自動的に通知が送信され、Slackハドルへの招待リンクが表示されます。指定された時間にハドルが自動的に開始されます。