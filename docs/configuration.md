# 設定値のドキュメント

このドキュメントでは、アプリケーションで使用する環境変数について説明します。

## 必須の環境変数

| 環境変数名        | 説明                                     | デフォルト値 |
| ----------------- | ---------------------------------------- | ------------ |
| `SLACK_BOT_TOKEN` | Slackボットのトークン（`xoxb-`で始まる） | -            |
| `MAX_USERS_PER_MATCH` | マッチングする最大ユーザー数 | 5 |

## 設定例

```bash
# 必須の環境変数
SLACK_BOT_TOKEN=xoxb-your-bot-token
MAX_USERS_PER_MATCH=10
```
