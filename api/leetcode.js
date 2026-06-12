// Vercel serverless function: GET /api/leetcode?user=<username>
// Proxies to the unofficial leetcode.com/graphql endpoint so the browser can
// bypass CORS. Returns the data needed to verify ownership (aboutMe) plus
// the user's public activity (submission calendar, recent ACs, totals).
//
// No auth, no secrets. The function is stateless and the data returned is
// already publicly viewable on the user's LeetCode profile page.

const GRAPHQL_URL = "https://leetcode.com/graphql";

const QUERY = `
  query userPublic($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        aboutMe
        ranking
        reputation
        userAvatar
      }
      submitStats {
        acSubmissionNum { difficulty count }
        totalSubmissionNum { difficulty count }
      }
      userCalendar {
        streak
        totalActiveDays
        submissionCalendar
      }
    }
    recentAcSubmissionList(username: $username, limit: 500) {
      id
      title
      titleSlug
      timestamp
    }
  }
`;

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const username = String(req.query?.user || "").trim();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(username)) {
    res.status(400).json({ error: "invalid_username" });
    return;
  }

  try {
    const lcRes = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (LeetCode-ELO-Explorer)",
        Referer: `https://leetcode.com/${username}/`
      },
      body: JSON.stringify({ query: QUERY, variables: { username } })
    });

    if (!lcRes.ok) {
      res.status(502).json({ error: "leetcode_upstream", status: lcRes.status });
      return;
    }

    const payload = await lcRes.json();
    if (payload?.errors?.length) {
      res.status(502).json({ error: "graphql_error", details: payload.errors });
      return;
    }

    const data = payload?.data || {};
    if (!data.matchedUser) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    // submissionCalendar comes back as a JSON-encoded string. Parse it
    // to { [unixSecondsAtMidnightUTC: string]: count }.
    let submissionCalendar = {};
    try {
      const raw = data.matchedUser.userCalendar?.submissionCalendar;
      if (typeof raw === "string") submissionCalendar = JSON.parse(raw);
    } catch {
      submissionCalendar = {};
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      username: data.matchedUser.username,
      aboutMe: data.matchedUser.profile?.aboutMe || "",
      ranking: data.matchedUser.profile?.ranking ?? null,
      avatar: data.matchedUser.profile?.userAvatar || null,
      submitStats: data.matchedUser.submitStats || null,
      streak: data.matchedUser.userCalendar?.streak ?? 0,
      totalActiveDays: data.matchedUser.userCalendar?.totalActiveDays ?? 0,
      submissionCalendar,
      recentAcSubmissionList: data.recentAcSubmissionList || []
    });
  } catch (e) {
    res.status(500).json({ error: "proxy_failure", message: String(e?.message || e) });
  }
};
