import {
  type Match,
  createMatches,
  deletePastAvailabilities,
} from "../../utils/availability";

export const handler = async (): Promise<Match[]> => {
  try {
    // 0分か30分の一番近い時刻を取得する
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes =
      minutes < 15 || (minutes >= 45 && minutes < 60) ? 0 : 30;
    const targetDatetime = new Date(now);
    targetDatetime.setMinutes(roundedMinutes, 0, 0);

    // マッチングを作成
    const matches = await createMatches(
      targetDatetime.toISOString().slice(0, 16),
    );

    // 過去の不要な登録データを削除
    try {
      const deletedCount = await deletePastAvailabilities();
      if (deletedCount > 0) {
        console.log(`${deletedCount}件の過去の登録データを削除しました`);
      }
    } catch (error) {
      console.error("過去データの削除処理中にエラーが発生しました:", error);
      // エラーが発生してもマッチング処理は続行
    }

    return matches;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};
