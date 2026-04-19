// src/integration/ShrineClient.ts
import { MONZEN_CONFIG } from '../core/config';

export class ShrineClient {
    private mainShrineUrl: string;
    private myNodeDomain: string;

    constructor(
        mainShrineUrl: string | undefined, 
        myNodeDomain: string | undefined
    ) {
        this.mainShrineUrl = mainShrineUrl || MONZEN_CONFIG.MAIN_SHRINE_URL;
        this.myNodeDomain = myNodeDomain || MONZEN_CONFIG.MY_NODE_DOMAIN;
    }

    /**
     * ⛩️ ノードの起動・生存報告 (Benchmark-First Payload)
     */
    async registerNode(payload: {
        node_role: string;
        public_evaluability: boolean;
        manifestUrl: string;
        benchmark_suite: string[];
        skill_endpoints: string[];
        supported_assets: string[];
        version: string;
    }): Promise<void> {
        if (this.myNodeDomain === "Your-domain-URL") {
            throw new Error("🚨 本殿への登録前に MY_NODE_DOMAIN を設定（環境変数で上書き）してください！");
        }

        const url = `${this.mainShrineUrl}/api/agent/monzen/register`;
        console.log(`[ShrineClient] Attempting to register benchmark provider at: ${url}`);
        
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodeUrl: `https://${this.myNodeDomain}`,
                    ...payload // リッチなペイロードを送信
                })
            });

            console.log(`[ShrineClient] Response: ${res.status} ${res.statusText}`);
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`[ShrineClient] Failed with details: ${errorText}`);
            } else {
                console.log(`[ShrineClient] Node registered successfully.`);
            }
        } catch (error: any) {
            console.error(`[ShrineClient] Fetch Error:`, error.message);
        }
    }

    /**
     * 🚨 罪人の通報
     */
    async reportSinner(agentId: string, reason: string, evidence: string): Promise<void> {
        const url = `${this.mainShrineUrl}/api/agent/monzen/report-sinner`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: agentId,
                    reportingNode: this.myNodeDomain,
                    reason: reason,
                    evidence: evidence
                })
            });
            console.log(`[ShrineClient] Reported sinner: ${agentId} (Status: ${res.status})`);
        } catch (error) {
            console.error(`[ShrineClient] Failed to report sinner:`, error);
        }
    }

    /**
     * 📜 最新の閻魔帳（ブラックリスト）取得
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