// src/integration/ShrineClient.ts
import { MONZEN_CONFIG } from '../core/config';

// ★ 新規追加: InteropCorpusItem の型定義
export interface InteropCorpusItem {
    corpus_id: string;
    schema_version: "interop_corpus_item.v1";
    source_observation_id?: string;
    source_run_id?: string;
    observed_at?: string;
    quality?: "strong" | "weak" | "diagnostic" | "invalid";
    target?: {
        host?: string;
        url?: string;
        scenario_id?: string;
    };
    protocol?: {
        rail?: string;
        authorization_scheme?: string;
        payment_intent?: string;
        payment_method?: string;
        draft_shape?: string;
    };
    challenge_shape?: {
        request_b64_present?: boolean;
        decoded_request_valid?: boolean;
        credential_shape?: string;
    };
    expected_client_behavior?: {
        action: "pay_and_verify" | "observe_only" | "stop_safely" | "reject_invalid";
        reason?: string;
    };
    verification?: {
        canonical_hash_matched?: boolean;
        payment_receipt_present?: boolean;
        status_code_after_payment?: number;
    };
}

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

    /**
     * ⛩️ 本殿から Corpus Item を取得する
     */
    async fetchCorpusItem(corpusId: string): Promise<InteropCorpusItem | null> {
        const url = `${this.mainShrineUrl}/api/agent/sandbox/interop/corpus/${corpusId}`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                if (res.status !== 404) console.warn(`[ShrineClient] Corpus API returned ${res.status}`);
                return null;
            }
            const data = await res.json() as any;
            return data.item || null;
        } catch (error) {
            console.error(`[ShrineClient] Failed to fetch corpus item:`, error);
            return null;
        }
    }

    /**
     * 🔍 Paid Surface Diagnostics (Seller-Side Observation Lookup)
     * 本殿に記録された自身の 402 Endpoint の摩擦観測結果を Read-Only で照会します。
     */
    async fetchFailureObservations(options: FailureObservationLookupOptions): Promise<FailureObservationLookupResult | null> {
        if (!options.targetDomain && !options.targetUrl) {
            throw new Error("Either targetDomain or targetUrl must be provided.");
        }

        const params = new URLSearchParams();
        if (options.targetDomain) params.append('targetDomain', options.targetDomain);
        if (options.targetUrl) params.append('targetUrl', options.targetUrl);
        if (options.limit) params.append('limit', options.limit.toString());

        const url = `${this.mainShrineUrl}/api/agent/external/failure-observations?${params.toString()}`;
        
        try {
            const res = await fetch(url);
            if (!res.ok) {
                return null; // 本殿の障害時は安全に null を返す
            }
            const data = await res.json() as FailureObservationLookupResult;
            return data;
        } catch (error) {
            console.error(`[ShrineClient] Failed to fetch failure observations:`, error);
            return null; // 通信失敗時も throw せず null を返す
        }
    }
}

export type FailureObservationLookupOptions = {
    targetDomain?: string;
    targetUrl?: string;
    limit?: number;
};

export type FailureObservationItem = {
    observation_id?: string;
    target_domain?: string;
    target_url?: string;
    rail?: string;
    network?: string;
    asset?: string;
    failure_class?: string;
    failure_subclass?: string;
    changed_fields?: string[];
    evidence_strength?: string;
    confidence?: string;
    reproducibility?: string;
    observed_at?: number | string;
    not_a_verdict?: boolean;
};

export type FailureObservationLookupResult = {
    status: string;
    targetDomain?: string;
    count?: number;
    latest_observed_at?: number | string;
    failure_classes?: Record<string, number>;
    items: FailureObservationItem[];
    disclaimer?: string;
};