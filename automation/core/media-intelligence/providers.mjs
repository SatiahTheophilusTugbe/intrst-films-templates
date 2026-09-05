import { normalizeError } from "../contracts/aut-009.mjs";
import { MediaIntelligenceError } from "./media-intelligence.mjs";

const DEFINITIONS = Object.freeze({
  transcriptapi: {
    role: "primary",
    credential_ref: "INT | TranscriptAPI | Development | Media Intelligence",
    tasks: ["youtube_search", "channel_discovery", "video_discovery", "playlist_discovery", "transcript_retrieval"]
  },
  scrapecreators: {
    role: "specialist_free_tier",
    credential_ref: "INT | ScrapeCreators | Development | Media Intelligence",
    tasks: ["audience_comments", "comment_replies", "shorts_intelligence", "community_intelligence", "competitor_enrichment"]
  }
});

class ProviderStub {
  constructor(provider) {
    this.provider = provider;
    this.definition = DEFINITIONS[provider];
  }

  async healthcheck() {
    return { provider: this.provider, ready: false, status: "credential_validation_pending", network_call_performed: false };
  }

  validate_config(config = {}) {
    if (config.environment !== "development" || config.credential_ref !== this.definition.credential_ref) throw new MediaIntelligenceError("CONFIG_INVALID", `${this.provider} requires its approved development logical credential reference.`);
    if (Object.keys(config).some((key) => /(?:api[_-]?key|secret|token|password|authorization|credential[_-]?id)/i.test(key))) throw new MediaIntelligenceError("SECRET_BOUNDARY", "Provider config cannot contain secret material or credential IDs.");
    return true;
  }

  async submit() {
    throw new MediaIntelligenceError("PROVIDER_NOT_CONNECTED", `${this.provider} runtime calls are not deployed.`);
  }

  async get_status() {
    throw new MediaIntelligenceError("PROVIDER_NOT_CONNECTED", `${this.provider} runtime calls are not deployed.`);
  }

  normalize_result() {
    throw new MediaIntelligenceError("NORMALIZER_NOT_IMPLEMENTED", `${this.provider} response normalization requires a captured Dolly fixture.`);
  }

  normalize_error(error) {
    return normalizeError(error);
  }
}

export class TranscriptAPIProvider extends ProviderStub {
  constructor() { super("transcriptapi"); }
}

export class ScrapeCreatorsProvider extends ProviderStub {
  constructor() { super("scrapecreators"); }
}

export { DEFINITIONS as MEDIA_PROVIDER_DEFINITIONS };
