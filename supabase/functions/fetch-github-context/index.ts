import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchGitHub(url: string, pat?: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ECP-App",
  };
  if (pat) headers.Authorization = `Bearer ${pat}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${text}`);
  }
  return resp.json();
}

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { github_url, github_pat } = await req.json();
    if (!github_url) {
      return new Response(JSON.stringify({ error: "github_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = parseRepoUrl(github_url);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Invalid GitHub URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { owner, repo } = parsed;
    const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

    // Fetch repo info and file tree in parallel
    const [repoInfo, tree] = await Promise.all([
      fetchGitHub(apiBase, github_pat),
      fetchGitHub(`${apiBase}/git/trees/HEAD?recursive=1`, github_pat).catch(() => ({ tree: [] })),
    ]);

    // Get key files content (README, package.json, etc.)
    const keyFiles = ["README.md", "readme.md", "package.json", "pyproject.toml", "Cargo.toml", "go.mod"];
    const treeFiles = (tree.tree || []) as Array<{ path: string; type: string; size?: number }>;
    const foundKeyFiles = treeFiles
      .filter((f: any) => f.type === "blob" && keyFiles.some((k) => f.path.toLowerCase() === k.toLowerCase()))
      .slice(0, 3);

    const fileContents: Record<string, string> = {};
    for (const file of foundKeyFiles) {
      try {
        const content = await fetchGitHub(`${apiBase}/contents/${file.path}`, github_pat);
        if (content.encoding === "base64" && content.content) {
          const decoded = atob(content.content.replace(/\n/g, ""));
          fileContents[file.path] = decoded.slice(0, 3000); // Limit size
        }
      } catch {
        // Skip files we can't read
      }
    }

    // Build a concise file tree (limit to important dirs)
    const fileTree = treeFiles
      .filter((f: any) => f.type === "blob")
      .map((f: any) => f.path)
      .slice(0, 200);

    // Scan source files for tracking calls
    const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|py)$/;
    const SKIP_PATTERNS = /node_modules|dist\/|build\/|\.test\.|\.spec\.|\.d\.ts|\.css$|\.json$|\.md$|\.svg$|\.png$/;
    const PRIORITY_KEYWORDS = /analytics|tracking|events?|posthog|mixpanel|gtag|segment|amplitude/i;
    const TRACKING_REGEX = [
      /\.(capture|track|logEvent|send)\s*\(\s*['"]([\w.:\-/ ]+)['"]/g,
      /gtag\s*\(\s*['"]event['"]\s*,\s*['"]([\w.:\-/ ]+)['"]/g,
    ];

    const sourceFiles = treeFiles
      .filter((f: any) => f.type === "blob" && SOURCE_EXTENSIONS.test(f.path) && !SKIP_PATTERNS.test(f.path));
    const priorityFiles = sourceFiles.filter((f: any) => PRIORITY_KEYWORDS.test(f.path));
    const otherFiles = sourceFiles.filter((f: any) => !PRIORITY_KEYWORDS.test(f.path));
    const filesToScan = [...priorityFiles, ...otherFiles].slice(0, 15);

    const trackingSnippets: Array<{ file: string; event: string; snippet: string }> = [];
    
    for (let i = 0; i < filesToScan.length; i += 5) {
      const batch = filesToScan.slice(i, i + 5);
      await Promise.allSettled(
        batch.map(async (file: any) => {
          try {
            const content = await fetchGitHub(`${apiBase}/contents/${file.path}`, github_pat);
            if (content.encoding === "base64" && content.content) {
              const decoded = atob(content.content.replace(/\n/g, ""));
              const lines = decoded.split("\n");
              for (const pattern of TRACKING_REGEX) {
                const regex = new RegExp(pattern.source, pattern.flags);
                let match;
                while ((match = regex.exec(decoded)) !== null) {
                  const eventName = match[2] || match[1];
                  const lineNum = decoded.slice(0, match.index).split("\n").length - 1;
                  const start = Math.max(0, lineNum - 10);
                  const end = Math.min(lines.length, lineNum + 10);
                  trackingSnippets.push({
                    file: file.path,
                    event: eventName,
                    snippet: lines.slice(start, end).join("\n"),
                  });
                }
              }
            }
          } catch { /* skip unreadable files */ }
        })
      );
    }

    const context = {
      repo: `${owner}/${repo}`,
      description: repoInfo.description || "",
      language: repoInfo.language || "",
      topics: repoInfo.topics || [],
      default_branch: repoInfo.default_branch,
      file_tree: fileTree,
      key_files: fileContents,
      tracking_snippets: trackingSnippets.slice(0, 50),
    };

    return new Response(JSON.stringify(context), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-github-context error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
