// src/integration/ShrineClient.ts

export class ShrineClient {
    constructor(
        private mainShrineUrl: string, // 例: https://kari.mayim-mayim.com
        private myNodeDomain: string   // 例: api.my-monzen.workers.dev
    ) {}

    /**
     * ⛩️ ノードの起動・生存報告
     * 本殿の Inquisitor に自身の存在と提供機能を知らせる
     */
    async registerNode(endpoints: string[]): Promise<void> {
        const url = `${this.mainShrineUrl}/api/agent/monzen/register`;
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodeUrl: `https://${this.myNodeDomain}`,
                    manifestUrl: `https://${this.myNodeDomain}`, 
                    endpoints: endpoints
                })
            });
            console.log(`[ShrineClient] Node registered successfully.`);
        } catch (error) {
            console.error(`[ShrineClient] Failed to register node:`, error);
        }
    }

    /**
     * 🚨 罪人の通報
     * 不正な決済試行（リプレイ攻撃等）を本殿へ報告する
     */
    async reportSinner(agentId: string, reason: string, evidence: string): Promise<void> {
        const url = `${this.mainShrineUrl}/api/agent/monzen/report-sinner`;
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: agentId,
                    reportingNode: this.myNodeDomain,
                    reason: reason,
                    evidence: evidence
                })
            });
            console.log(`[ShrineClient] Reported sinner: ${agentId}`);
        } catch (error) {
            console.error(`[ShrineClient] Failed to report sinner:`, error);
        }
    }

    /**
     * 📜 最新の閻魔帳（ブラックリスト）取得
     * Cronジョブで定期的に呼び出し、KVキャッシュを更新するためのリストを取得する
     */
    async fetchBlacklist(): Promise<string[]> {
        const url = `${this.mainShrineUrl}/api/agent/monzen/blacklist`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.warn(`[ShrineClient] Blacklist API returned status: ${res.status}`);
                return [];
            }
            const data = await res.json() as { blacklist?: string[] };
            return data.blacklist || [];
        } catch (error) {
            console.error(`[ShrineClient] Failed to fetch blacklist:`, error);
            return [];
        }
    }
}