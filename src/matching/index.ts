import { Match, createMatches, deletePastAvailabilities } from '../utils/availability';

export const handler = async (): Promise<Match[]> => {
  try {
    // マッチングを作成
    const matches = await createMatches();

    // 過去の不要な登録データを削除
    try {
      const deletedCount = await deletePastAvailabilities();
      if (deletedCount > 0) {
        console.log(`${deletedCount}件の過去の登録データを削除しました`);
      }
    } catch (error) {
      console.error('過去データの削除処理中にエラーが発生しました:', error);
      // エラーが発生してもマッチング処理は続行
    }

    return matches;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}; 