export class FirstCommentContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "FirstCommentContractError";
    this.code = code;
    this.details = details;
  }
}

const COMMENT_PLATFORMS = new Set(["facebook", "instagram"]);

function fail(code, message, details) {
  throw new FirstCommentContractError(code, message, details);
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") fail("SCHEMA_VALIDATION", `${name} is required.`);
  return value.trim();
}

function publishedBlotatoPostId(item) {
  const state = item?.state?.type ?? item?.state;
  if (state !== "published") return null;
  const postId = item?.postId ?? item?.post_id ?? item?.id;
  return typeof postId === "string" && postId.trim() ? postId.trim() : null;
}

export function createBlotatoFirstCommentAdapter({ listPublishedPosts, postComment }) {
  if (typeof listPublishedPosts !== "function" || typeof postComment !== "function") {
    fail("ADAPTER_CONTRACT_INVALID", "First-comment adapter requires listPublishedPosts and postComment.");
  }

  return {
    name: "blotato-mcp-first-comment",
    supportedPlatforms: [...COMMENT_PLATFORMS],

    async resolvePublishedPostId({ platform, account_id, postSubmissionId, since, until }) {
      if (!COMMENT_PLATFORMS.has(platform)) fail("PLATFORM_UNSUPPORTED", `First comments are unsupported for ${platform}.`);
      const items = await listPublishedPosts({ platform, status: ["published"], since, until, limit: 250 });
      if (!Array.isArray(items)) fail("POST_LOOKUP_INVALID", "Published post lookup must return an array.");
      const candidates = items
        .filter((item) => (item?.platform ?? item?.content?.platform) === platform)
        .filter((item) => !account_id || item?.accountId === account_id || item?.account_id === account_id)
        .filter((item) => {
          if (!postSubmissionId) return true;
          return [item?.postSubmissionId, item?.post_submission_id, item?.submissionId].includes(postSubmissionId);
        })
        .map((item) => ({ item, postId: publishedBlotatoPostId(item) }))
        .filter(({ postId }) => postId);
      if (candidates.length === 0) fail("POST_ID_UNRESOLVED", "No uniquely matching published Blotato post was found.");
      if (candidates.length !== 1) fail("POST_ID_AMBIGUOUS", "More than one published Blotato post matches the publication lineage.");
      return candidates[0].postId;
    },

    async postFirstComment({ platform, postId, text, postIdSource }) {
      if (!COMMENT_PLATFORMS.has(platform)) fail("PLATFORM_UNSUPPORTED", `First comments are unsupported for ${platform}.`);
      if (postIdSource !== "blotato_list_posts.published.postId") fail("POST_ID_UNRESOLVED", "postId must come from a published blotato_list_posts item.");
      const commentText = requiredString(text, "first comment text");
      const publishedPostId = requiredString(postId, "published Blotato postId");
      const result = await postComment({ postId: publishedPostId, text: commentText });
      return {
        platform,
        post_id: publishedPostId,
        status: result?.status ?? "queued",
        comment_id: result?.commentId ?? result?.comment_id ?? result?.id ?? null,
        parent_comment_id: null,
        attempt_count: 1,
        retry_count: 0,
      };
    },
  };
}
