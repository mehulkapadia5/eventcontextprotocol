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

    const context = {
      repo: `${owner}/${repo}`,
      description: repoInfo.description || "",
      language: repoInfo.language || "",
      topics: repoInfo.topics || [],
      default_branch: repoInfo.default_branch,
      file_tree: fileTree,
      key_files: fileContents,
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
