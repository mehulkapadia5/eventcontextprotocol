import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|py|go|rb|java|kt|swift|vue|svelte|php)$/;
const SKIP_PATTERNS = /node_modules|dist\/|build\/|\.next\/|\.git\/|vendor\/|__pycache__|\.lock$|lock\.json$|lock\.yaml$|\.min\.|\.map$|\.d\.ts$/;
const PRIORITY_FOLDERS = /\/(components|pages|hooks|services|api|lib|utils|src|app|views|controllers|routes|middleware)\//i;

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

async function fetchGitHub(url: string, pat?: string, retries = 3): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Magnitude-App",
  };
  if (pat) headers.Authorization = `Bearer ${pat}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    const resp = await fetch(url, { headers });
    if (resp.ok) return resp.json();

    if ((resp.status === 403 || resp.status === 429) && attempt < retries - 1) {
      const wait = Math.pow(2, attempt + 1) * 1000;
      console.log(`Rate limited (${resp.status}), waiting ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    const text = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${text}`);
  }
}

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", go: "go", rb: "ruby", java: "java", kt: "kotlin",
    swift: "swift", vue: "vue", svelte: "svelte", php: "php",
  };
  return map[ext] || ext;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { project_id, github_url: bodyGithubUrl, github_pat: bodyGithubPat } = body;
    if (!project_id) throw new Error("project_id required");

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");
    const userId = user.id;

    // Get github_url and github_pat from request body or profile
    let github_url = bodyGithubUrl;
    let github_pat = bodyGithubPat;

    if (!github_url) {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("onboarding_data")
        .eq("user_id", userId)
        .single();

      const onboardingData = profile?.onboarding_data as any;
      const codebase = onboardingData?.codebase || {};
      github_url = codebase?.github_url || onboardingData?.github_url;
      github_pat = github_pat || codebase?.github_pat || onboardingData?.github_pat;
    }

    if (!github_url) throw new Error("No GitHub URL configured. Please connect your repository first.");

    // Save github_url to profile if it came from request body
    if (bodyGithubUrl) {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("onboarding_data")
        .eq("user_id", userId)
        .single();
      const existingData = (profile?.onboarding_data as any) || {};
      const updatedData = {
        ...existingData,
        codebase: { ...(existingData.codebase || {}), github_url: bodyGithubUrl, ...(bodyGithubPat ? { github_pat: bodyGithubPat } : {}) },
      };
      await serviceClient.from("profiles").update({ onboarding_data: updatedData }).eq("user_id", userId);
    }

    const parsed = parseRepoUrl(github_url);
    if (!parsed) throw new Error("Invalid GitHub URL");
    const { owner, repo } = parsed;
    const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

    // Upsert repo_index_status → indexing
    await serviceClient.from("repo_index_status").upsert(
      { project_id, github_url, status: "indexing", indexed_files: 0, total_files: 0, error_message: null, updated_at: new Date().toISOString() },
      { onConflict: "project_id" }
    );

    // Fetch full tree
    const tree = await fetchGitHub(`${apiBase}/git/trees/HEAD?recursive=1`, github_pat);
    const treeFiles = ((tree.tree || []) as Array<{ path: string; type: string; size?: number }>)
      .filter((f) => f.type === "blob" && SOURCE_EXTENSIONS.test(f.path) && !SKIP_PATTERNS.test(f.path));

    // Sort: priority folders first
    const priority = treeFiles.filter((f) => PRIORITY_FOLDERS.test(f.path));
    const others = treeFiles.filter((f) => !PRIORITY_FOLDERS.test(f.path));
    const filesToFetch = [...priority, ...others].slice(0, 500);

    const totalFiles = filesToFetch.length;
    await serviceClient.from("repo_index_status").update({ total_files: totalFiles, updated_at: new Date().toISOString() }).eq("project_id", project_id);

    console.log(`Indexing ${totalFiles} files from ${owner}/${repo}`);

    let indexedCount = 0;

    // Fetch in batches of 5
    for (let i = 0; i < filesToFetch.length; i += 5) {
      const batch = filesToFetch.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (file) => {
          const content = await fetchGitHub(`${apiBase}/contents/${file.path}`, github_pat);
          if (content.encoding === "base64" && content.content) {
            const decoded = atob(content.content.replace(/\n/g, ""));
            return {
              project_id,
              file_path: file.path,
              content: decoded,
              file_size: decoded.length,
              language: getLanguage(file.path),
              last_indexed_at: new Date().toISOString(),
            };
          }
          return null;
        })
      );

      const rows = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value !== null)
        .map((r) => r.value);

      if (rows.length > 0) {
        const { error } = await serviceClient.from("repo_files").upsert(rows, { onConflict: "project_id,file_path" });
        if (error) console.error("Upsert error:", error.message);
      }

      indexedCount += rows.length;
      await serviceClient.from("repo_index_status").update({ indexed_files: indexedCount, updated_at: new Date().toISOString() }).eq("project_id", project_id);
    }

    // Mark completed
    await serviceClient.from("repo_index_status").update({
      status: "completed",
      indexed_files: indexedCount,
      last_indexed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("project_id", project_id);

    return new Response(JSON.stringify({ success: true, total_files: totalFiles, indexed_files: indexedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("index-github-repo error:", e);
    // Try to mark as failed
    try {
      const { project_id } = await req.clone().json().catch(() => ({}));
      if (project_id) {
        await serviceClient.from("repo_index_status").update({
          status: "failed",
          error_message: e instanceof Error ? e.message : "Unknown error",
          updated_at: new Date().toISOString(),
        }).eq("project_id", project_id);
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
