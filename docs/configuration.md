# 設定値のドキュメント

このドキュメントでは、アプリケーションで使用する環境変数について説明します。

## 必須の環境変数

| 環境変数名             | 説明                                                  | デフォルト値 |
| ---------------------- | ----------------------------------------------------- | ------------ |
| `SLACK_BOT_TOKEN`      | Slackボットのトークン（`xoxb-`で始まる）              | -            |

## オプションの環境変数

### ログ設定

| 環境変数名  | 説明                                           | デフォルト値 |
| ----------- | ---------------------------------------------- | ------------ |
| `LOG_LEVEL` | ログレベル（`DEBUG`、`INFO`、`WARN`、`ERROR`） | `INFO`       |

### マッチング設定

| 環境変数名    | 説明                         | デフォルト値 |
| ------------- | ---------------------------- | ------------ |
| `MIN_MEMBERS` | マッチング時の最小メンバー数 | `2`          |
| `MAX_MEMBERS` | マッチング時の最大メンバー数 | `10`         |

### ハドル設定

| 環境変数名       | 説明                                         | デフォルト値 |
| ---------------- | -------------------------------------------- | ------------ |
| `CHANNEL_PREFIX` | ハドルチャンネルのプレフィックス             | `huddle-`    |
| `HUDDLE_PRIVATE` | ハドルチャンネルをプライベートにするかどうか | `true`       |

## 設定例

```bash
# 必須の環境変数
SLACK_BOT_TOKEN=xoxb-your-bot-token

# オプションの環境変数
LOG_LEVEL=DEBUG
MIN_MEMBERS=3
MAX_MEMBERS=5
CHANNEL_PREFIX=team-huddle-
HUDDLE_PRIVATE=false
```

## バリデーションルール

1. `SLACK_BOT_TOKEN`は必須です
2. `LOG_LEVEL`は`DEBUG`、`INFO`、`WARN`、`ERROR`のいずれかである必要があります
3. `MIN_MEMBERS`は0より大きい数値である必要があります
4. `MAX_MEMBERS`は`MIN_MEMBERS`以上である必要があります
5. `CHANNEL_PREFIX`は空文字列であってはいけません

## エラーメッセージ

設定値のバリデーションに失敗した場合、以下のような形式でエラーメッセージが返されます：

```json
{
  "error": "Configuration validation failed",
  "details": [
    {
      "field": "SLACK_BOT_TOKEN",
      "message": "Slack bot token is required"
    }
  ]
}
``` 