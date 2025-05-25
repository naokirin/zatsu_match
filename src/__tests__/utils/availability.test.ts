import "aws-sdk-client-mock-jest";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import {
  createMatches,
  deletePastAvailabilities,
  isWithinTwoWeeks,
  parseTimeRange,
} from "../../utils/availability";

describe("空き時間管理機能", () => {
  const mockDynamoDB = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    mockDynamoDB.reset();

    mockDynamoDB.on(QueryCommand).resolves({ Items: [] });
    mockDynamoDB.on(PutCommand).resolves({});
    mockDynamoDB.on(DeleteCommand).resolves({});
    mockDynamoDB.on(GetCommand).resolves({ Item: undefined });
  });

  describe("parseTimeRange()", () => {
    it("時間範囲を正しくパースすること（時間単位）", () => {
      const dateStr = "2023-12-15";
      const timeRange = "13:00-15:00";

      const result = parseTimeRange(dateStr, timeRange);

      expect(result).toEqual([
        "2023-12-15T13:00",
        "2023-12-15T13:30",
        "2023-12-15T14:00",
        "2023-12-15T14:30",
      ]);
    });

    it("時間範囲を正しくパースすること（30分単位）", () => {
      const dateStr = "2023-12-15";
      const timeRange = "13:30-15:30";

      const result = parseTimeRange(dateStr, timeRange);

      expect(result).toEqual([
        "2023-12-15T13:30",
        "2023-12-15T14:00",
        "2023-12-15T14:30",
        "2023-12-15T15:00",
      ]);
    });

    it("時間範囲を正しくパースすること（1時間だけ）", () => {
      const dateStr = "2023-12-15";
      const timeRange = "13:00-14:00";

      const result = parseTimeRange(dateStr, timeRange);

      expect(result).toEqual(["2023-12-15T13:00", "2023-12-15T13:30"]);
    });

    it("時間範囲を正しくパースすること（30分だけ）", () => {
      const dateStr = "2023-12-15";
      const timeRange = "13:00-13:30";

      const result = parseTimeRange(dateStr, timeRange);

      expect(result).toEqual(["2023-12-15T13:00"]);
    });

    it("不正な時間範囲でエラーをスローすること（フォーマットエラー）", () => {
      const dateStr = "2023-12-15";
      const timeRange = "13:00";

      expect(() => {
        parseTimeRange(dateStr, timeRange);
      }).toThrow(
        "Invalid time range format: 13:00. Expected format: HH:MM-HH:MM",
      );
    });

    it("不正な時間範囲でエラーをスローすること（開始時間が終了時間より後）", () => {
      const dateStr = "2023-12-15";
      const timeRange = "15:00-13:00";

      expect(() => {
        parseTimeRange(dateStr, timeRange);
      }).toThrow(
        "Invalid time range: 15:00-13:00. End time must be later than start time.",
      );
    });

    it("不正な時間範囲でエラーをスローすること（同じ時間）", () => {
      const dateStr = "2023-12-15";
      const timeRange = "13:00-13:00";

      expect(() => {
        parseTimeRange(dateStr, timeRange);
      }).toThrow(
        "Invalid time range: 13:00-13:00. End time must be later than start time.",
      );
    });

    it("不正な時間形式でエラーをスローすること", () => {
      const dateStr = "2023-12-15";
      const timeRange = "13:xx-15:00";

      expect(() => {
        parseTimeRange(dateStr, timeRange);
      }).toThrow("Invalid time format: 13:xx. Expected format: HH:MM");
    });
  });

  describe("deletePastAvailabilities()", () => {
    it("現在時刻より前の登録データを削除すること", async () => {
      // 現在時刻をモックする
      const nowMock = new Date("2023-12-15T12:00:00Z");
      jest.spyOn(global, "Date").mockImplementation(() => nowMock);

      // モックの戻り値を設定（過去と未来の両方のデータを含む）
      const mockItems = [
        {
          userId: "U111111",
          timestamp: "2023-12-15T10:00",
          channelId: "C111111",
          createdAt: "2023-12-01T00:00:00Z",
        }, // 過去
        {
          userId: "U222222",
          timestamp: "2023-12-15T11:00",
          channelId: "C222222",
          createdAt: "2023-12-01T00:00:00Z",
        }, // 過去
        {
          userId: "U333333",
          timestamp: "2023-12-15T12:00",
          channelId: "C333333",
          createdAt: "2023-12-01T00:00:00Z",
        }, // 現在（削除対象外）
        {
          userId: "U444444",
          timestamp: "2023-12-15T13:00",
          channelId: "C444444",
          createdAt: "2023-12-01T00:00:00Z",
        }, // 未来（削除対象外）
      ];

      mockDynamoDB.on(ScanCommand).resolves({ Items: mockItems });

      // 関数実行
      const deletedCount = await deletePastAvailabilities();

      // 検証
      expect(deletedCount).toBe(2); // 2件削除されるはず

      const scanCalls = mockDynamoDB
        .calls()
        .filter((call) => call.args[0] instanceof ScanCommand);
      expect(scanCalls).toHaveLength(1);

      const deleteCalls = mockDynamoDB
        .calls()
        .filter((call) => call.args[0] instanceof DeleteCommand);
      expect(deleteCalls).toHaveLength(2);

      // 削除対象が正しいか確認
      expect(deleteCalls[0].args[0].input).toEqual({
        TableName: "zatsumaches",
        Key: {
          userId: "U111111",
          timestamp: "2023-12-15T10:00",
        },
      });

      expect(deleteCalls[1].args[0].input).toEqual({
        TableName: "zatsumaches",
        Key: {
          userId: "U222222",
          timestamp: "2023-12-15T11:00",
        },
      });

      // モックをリセット
      jest.restoreAllMocks();
    });

    it("削除対象がない場合は0を返すこと", async () => {
      // 現在時刻をモックする
      const nowMock = new Date("2023-12-15T12:00:00Z");
      jest.spyOn(global, "Date").mockImplementation(() => nowMock);

      // 現在時刻以降のデータのみを含むモックを設定
      const mockItems = [
        {
          userId: "U333333",
          timestamp: "2023-12-15T12:00",
          channelId: "C333333",
          createdAt: "2023-12-01T00:00:00Z",
        }, // 現在（削除対象外）
        {
          userId: "U444444",
          timestamp: "2023-12-15T13:00",
          channelId: "C444444",
          createdAt: "2023-12-01T00:00:00Z",
        }, // 未来（削除対象外）
      ];

      mockDynamoDB.on(ScanCommand).resolves({ Items: mockItems });

      // 関数実行
      const deletedCount = await deletePastAvailabilities();

      // 検証
      expect(deletedCount).toBe(0); // 削除対象なし

      const scanCalls = mockDynamoDB
        .calls()
        .filter((call) => call.args[0] instanceof ScanCommand);
      expect(scanCalls).toHaveLength(1);

      const deleteCalls = mockDynamoDB
        .calls()
        .filter((call) => call.args[0] instanceof DeleteCommand);
      expect(deleteCalls).toHaveLength(0); // 削除コマンドは呼ばれない

      // モックをリセット
      jest.restoreAllMocks();
    });

    it("エラーが発生した場合はエラーをスローすること", async () => {
      // スキャンでエラーが発生する場合をモック
      mockDynamoDB.on(ScanCommand).rejects(new Error("テスト用エラー"));

      // エラーがスローされることを確認
      await expect(deletePastAvailabilities()).rejects.toThrow(
        "テスト用エラー",
      );
    });
  });

  describe("createMatches()", () => {
    it("指定した時刻のマッチングを生成すること", async () => {
      // モックデータを設定
      const mockItems = [
        { userId: "U1", timestamp: "2023-12-15T13:00", channelId: "C1" },
        { userId: "U2", timestamp: "2023-12-15T13:00", channelId: "C2" },
        { userId: "U3", timestamp: "2023-12-15T13:00", channelId: "C3" },
        { userId: "U4", timestamp: "2023-12-15T13:00", channelId: "C4" },
        { userId: "U5", timestamp: "2023-12-15T13:00", channelId: "C5" },
        { userId: "U6", timestamp: "2023-12-15T13:00", channelId: "C6" },
        { userId: "U7", timestamp: "2023-12-15T14:00", channelId: "C7" },
      ];
      mockDynamoDB.on(ScanCommand).resolves({ Items: mockItems });

      // 関数実行
      const result = await createMatches("2023-12-15T13:00");

      // 検証
      const scanCalls = mockDynamoDB
        .calls()
        .filter((call) => call.args[0] instanceof ScanCommand);
      expect(scanCalls).toHaveLength(1);

      // 結果の確認
      expect(result).toHaveLength(2); // 2つのグループができるはず

      // 最初のグループは5人（最大人数）
      expect(result[0].timestamp).toBe("2023-12-15T13:00");
      expect(result[0].users).toHaveLength(5);
      expect(result[0].channelIds).toHaveLength(5);

      // 2つ目のグループは1人
      expect(result[1].timestamp).toBe("2023-12-15T13:00");
      expect(result[1].users).toHaveLength(1);
      expect(result[1].channelIds).toHaveLength(1);

      // 全員が含まれていることを確認
      const allUsers = [...result[0].users, ...result[1].users];
      expect(allUsers.sort()).toEqual(
        ["U1", "U2", "U3", "U4", "U5", "U6"].sort(),
      );
    });

    it("デフォルトでは30分後の時刻のマッチングを生成すること", async () => {
      // テスト用の固定時刻
      const testTimeStr = "2023-12-15T13:00";

      // createMatchesに渡す時刻をモック
      jest.spyOn(global, "Date").mockImplementation(() => {
        return {
          getTime: () => 1234567890000, // 実際の値は重要ではない
          toISOString: () => `${testTimeStr}:00.000Z`, // 必ず16文字にスライスされたときにtestTimeStrになるよう設定
        } as unknown as Date;
      });

      // モックデータを設定
      const mockItems = [
        { userId: "U1", timestamp: testTimeStr, channelId: "C1" },
        { userId: "U2", timestamp: testTimeStr, channelId: "C2" },
        { userId: "U3", timestamp: "2023-12-15T14:00", channelId: "C3" },
      ];
      mockDynamoDB.on(ScanCommand).resolves({ Items: mockItems });

      try {
        const result = await createMatches(
          new Date().toISOString().slice(0, 16),
        );

        // 検証
        expect(result).toHaveLength(1);
        expect(result[0].timestamp).toBe(testTimeStr);
        expect(result[0].users).toEqual(["U1", "U2"]);
        expect(result[0].channelIds).toEqual(["C1", "C2"]);
      } finally {
        // グローバルモックを元に戻す
        jest.restoreAllMocks();
      }
    });

    it("該当する時刻のユーザーがいない場合は空の配列を返すこと", async () => {
      // モックデータを設定
      const mockItems = [
        { userId: "U1", timestamp: "2023-12-15T14:00", channelId: "C1" },
        { userId: "U2", timestamp: "2023-12-15T14:00", channelId: "C2" },
      ];
      mockDynamoDB.on(ScanCommand).resolves({ Items: mockItems });

      // 関数実行
      const result = await createMatches("2023-12-15T13:00");

      // 検証
      expect(result).toHaveLength(0);
    });
  });

  describe("isWithinTwoWeeks", () => {
    it("現在の日付を含む2週間以内の日付を許可する", () => {
      const today = new Date();
      const oneHourLater = new Date();
      oneHourLater.setHours(today.getHours() + 1);
      const withinTwoWeeks = new Date();
      withinTwoWeeks.setDate(today.getDate() + 13);

      expect(isWithinTwoWeeks(oneHourLater.toISOString())).toBe(true);
      expect(isWithinTwoWeeks(withinTwoWeeks.toISOString().split("T")[0])).toBe(
        true,
      );
    });

    it("2週間を超える日付を拒否する", () => {
      const today = new Date();
      const beyondTwoWeeks = new Date();
      beyondTwoWeeks.setDate(today.getDate() + 15);

      expect(isWithinTwoWeeks(beyondTwoWeeks.toISOString().split("T")[0])).toBe(
        false,
      );
    });

    it("過去の日付を拒否する", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      expect(isWithinTwoWeeks(pastDate.toISOString().split("T")[0])).toBe(
        false,
      );
    });
  });
});
